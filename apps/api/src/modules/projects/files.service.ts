import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { extractText, getDocumentProxy, renderPageAsImage } from 'unpdf';
import type { FileKind, ProjectFile } from '@connecta/db';
import { FILE_RULES, type ProjectFile as ProjectFileResponse } from '@connecta/shared';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { sniffFile } from '../../common/files.js';
import { iso } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { keys, Storage } from '../../infra/storage.js';

const PAGE_WIDTH = 1800; // px · sharp enough to zoom a poster
const MAX_PAGES = 60;
const CHUNK_CHARS = 1200;
const SINGLE: FileKind[] = ['POSTER', 'SLIDES', 'MODEL_3D']; // a new upload replaces the old one
const LABEL: Record<FileKind, string> = { POSTER: 'Poster', SLIDES: 'Slides', DOC: 'Document', MODEL_3D: '3D model' };

@Injectable()
export class FilesService {
  private readonly log = new Logger(FilesService.name);

  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
    private readonly bus: HallBus,
    private readonly audit: Audit,
  ) {}

  async toResponse(eventId: string, f: ProjectFile): Promise<ProjectFileResponse> {
    const ext = f.objectKey.split('.').pop() ?? '';
    const name = `${LABEL[f.kind]}.${ext}`;
    const pages = f.pageCount ?? 0;
    return {
      id: f.id,
      kind: f.kind,
      name,
      url: await this.storage.signedUrl(f.objectKey, name),
      pageUrls: await Promise.all(Array.from({ length: pages }, (_, i) => this.storage.signedUrl(keys.filePage(eventId, f.projectId, f.id, i + 1)))),
      pageCount: f.pageCount,
      mime: f.mime,
      sizeBytes: Number(f.sizeBytes),
      useForAi: f.useForAi,
      createdAt: iso(f.createdAt),
    };
  }

  /** 202: stored now, pages render in the background and the booth updates when they're ready */
  async upload(ctx: AccessCtx, user: AuthUser, kind: FileKind, useForAi: boolean, file: Express.Multer.File | undefined) {
    const p = ctx.project!;
    if (kind === 'MODEL_3D' && !(ctx.event.modules as { model3d?: boolean }).model3d) throw new AppError('MODULE_DISABLED');
    const rule = FILE_RULES[kind];
    const sniffed = await sniffFile(file, rule.mimes, rule.maxBytes);
    if (SINGLE.includes(kind)) {
      const old = await this.db.projectFile.findMany({ where: { projectId: p.id, kind } });
      for (const o of old) await this.removeRow(p.eventId, o);
    }
    const row = await this.db.projectFile.create({
      data: { projectId: p.id, kind, objectKey: 'pending', mime: sniffed.mime, sizeBytes: file!.size, useForAi: useForAi && kind !== 'MODEL_3D', uploadedById: user.id },
    });
    const objectKey = keys.fileOriginal(p.eventId, p.id, row.id, sniffed.ext);
    await this.storage.put(objectKey, file!.buffer, sniffed.mime);
    const saved = await this.db.projectFile.update({ where: { id: row.id }, data: { objectKey } });
    void this.process(p.eventId, saved, file!.buffer).catch((e) => this.log.error(`processing ${row.id}: ${e.message}`));
    await this.db.project.update({ where: { id: p.id }, data: { version: { increment: 1 } } });
    await this.audit.log(p.eventId, user.id, 'file.upload', row.id, { kind, mime: sniffed.mime });
    return this.toResponse(p.eventId, saved);
  }

  private async process(eventId: string, f: ProjectFile, buffer: Buffer) {
    if (f.kind === 'POSTER' || f.kind === 'SLIDES') {
      const pages = f.mime === 'application/pdf' ? await this.renderPdf(eventId, f, buffer) : await this.renderImage(eventId, f, buffer);
      await this.db.projectFile.update({ where: { id: f.id }, data: { pageCount: pages } });
    }
    if (f.useForAi) await this.index(f, buffer);
    await this.bus.publish(eventId, { type: 'boothUpdated', projectId: f.projectId });
  }

  private async renderPdf(eventId: string, f: ProjectFile, buffer: Buffer) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const count = Math.min(pdf.numPages, MAX_PAGES);
    for (let n = 1; n <= count; n++) {
      const page = await pdf.getPage(n);
      const scale = PAGE_WIDTH / page.getViewport({ scale: 1 }).width;
      const png = await renderPageAsImage(pdf, n, { canvasImport: () => import('@napi-rs/canvas'), scale });
      const webp = await sharp(Buffer.from(png)).webp({ quality: 82 }).toBuffer();
      await this.storage.put(keys.filePage(eventId, f.projectId, f.id, n), webp, 'image/webp');
    }
    return count;
  }

  private async renderImage(eventId: string, f: ProjectFile, buffer: Buffer) {
    const webp = await sharp(buffer).rotate().resize({ width: PAGE_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    await this.storage.put(keys.filePage(eventId, f.projectId, f.id, 1), webp, 'image/webp');
    return 1;
  }

  /** Text for the booth AI assistant (RAG) · chunks are searched with Postgres full-text */
  private async index(f: ProjectFile, buffer: Buffer) {
    const text = f.mime === 'application/pdf' ? (await extractText(new Uint8Array(buffer), { mergePages: true })).text : buffer.toString('utf8');
    const chunks = splitText(text);
    await this.db.$transaction([
      this.db.docChunk.deleteMany({ where: { fileId: f.id } }),
      this.db.docChunk.createMany({ data: chunks.map((content) => ({ projectId: f.projectId, fileId: f.id, content })) }),
    ]);
  }

  async setUseForAi(ctx: AccessCtx, fileId: string, useForAi: boolean) {
    const f = await this.db.projectFile.findUnique({ where: { id: fileId } });
    if (f?.projectId !== ctx.project!.id) throw new AppError('NOT_FOUND');
    if (f.kind === 'MODEL_3D') throw new AppError('UNSUPPORTED_FILE', '3D models have no text');
    const updated = await this.db.projectFile.update({ where: { id: fileId }, data: { useForAi } });
    if (useForAi) await this.index(updated, await this.storage.get(updated.objectKey));
    else await this.db.docChunk.deleteMany({ where: { fileId } });
    return this.toResponse(ctx.event.id, updated);
  }

  async remove(ctx: AccessCtx, user: AuthUser, fileId: string) {
    const f = await this.db.projectFile.findUnique({ where: { id: fileId } });
    if (f?.projectId !== ctx.project!.id) throw new AppError('NOT_FOUND');
    await this.removeRow(ctx.event.id, f);
    await this.bus.publish(ctx.event.id, { type: 'boothUpdated', projectId: f.projectId });
    await this.audit.log(ctx.event.id, user.id, 'file.delete', fileId);
  }

  private async removeRow(eventId: string, f: ProjectFile) {
    await this.db.projectFile.delete({ where: { id: f.id } }); // doc_chunks cascade
    await this.storage.deletePrefix(keys.file(eventId, f.projectId, f.id));
  }
}

function splitText(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  for (let i = 0; i < clean.length && out.length < 400; i += CHUNK_CHARS - 150) out.push(clean.slice(i, i + CHUNK_CHARS));
  return out;
}
