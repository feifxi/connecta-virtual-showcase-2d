import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { AppError } from '../../common/problem.js';
import { Db } from '../../infra/db.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AiService } from './ai.service.js';

type Row = { title: string; category: string | null; memberEmails: string[]; summary: string | null; errors: string[] };
const email = z.email();
const HEADERS = { title: ['title', 'project', 'project title', 'ชื่อผลงาน'], category: ['category', 'zone', 'หมวด'], members: ['members', 'emails', 'member emails', 'อีเมล'], summary: ['summary', 'description', 'คำอธิบาย'] };

/** Import is a skeleton only (title · category · member emails · short summary) · presenters fill in the rest */
@Injectable()
export class ImportService {
  constructor(
    private readonly db: Db,
    private readonly projects: ProjectsService,
    private readonly ai: AiService,
  ) {}

  async run(ctx: AccessCtx, user: AuthUser, source: { file?: Express.Multer.File; text?: string }, dryRun: boolean) {
    const categories = await this.db.eventCategory.findMany({ where: { eventId: ctx.event.id }, select: { id: true, name: true } });
    const names = categories.map((c) => c.name);
    let raw: Omit<Row, 'errors'>[];
    if (source.file) raw = await this.fromFile(source.file);
    else if (source.text?.trim()) raw = await this.ai.extractProjects(ctx, source.text, names);
    else throw new AppError('VALIDATION_FAILED', 'Upload a CSV/XLSX file or paste text');

    const rows: Row[] = raw.slice(0, 300).map((r) => {
      const errors: string[] = [];
      if (!r.title.trim()) errors.push('Missing title');
      const bad = r.memberEmails.filter((e) => !email.safeParse(e).success);
      if (bad.length) errors.push(`Invalid email: ${bad.join(', ')}`);
      const category = r.category ? (names.find((n) => n.toLowerCase() === r.category!.toLowerCase()) ?? null) : null;
      if (names.length && !category) errors.push(r.category ? `Unknown category "${r.category}"` : 'Missing category');
      return { title: r.title.trim(), category, memberEmails: r.memberEmails.filter((e) => email.safeParse(e).success).map((e) => e.toLowerCase()), summary: r.summary, errors };
    });
    if (dryRun) return { rows, created: 0 };
    let created = 0;
    for (const r of rows.filter((x) => !x.errors.length)) {
      await this.projects.create(ctx, user, { title: r.title, categoryId: categories.find((c) => c.name === r.category)?.id ?? null, memberEmails: r.memberEmails, summary: r.summary ?? undefined });
      created++;
    }
    return { rows, created };
  }

  private async fromFile(file: Express.Multer.File) {
    const name = file.originalname.toLowerCase();
    let table: string[][];
    if (name.endsWith('.xlsx')) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
      const sheet = wb.worksheets[0];
      if (!sheet) throw new AppError('VALIDATION_FAILED', 'The workbook is empty');
      table = [];
      sheet.eachRow((row) => table.push((row.values as unknown[]).slice(1).map((v) => (v && typeof v === 'object' && 'text' in v ? String((v as { text: string }).text) : String(v ?? '')))));
    } else if (name.endsWith('.csv')) {
      table = parseCsv(file.buffer.toString('utf8').replace(/^﻿/, ''));
    } else {
      throw new AppError('UNSUPPORTED_FILE', 'Use .csv or .xlsx (or paste text for AI import)');
    }
    const [header = [], ...body] = table;
    const col = (keys: string[]) => header.findIndex((h) => keys.includes(h.trim().toLowerCase()));
    const ix = { title: col(HEADERS.title), category: col(HEADERS.category), members: col(HEADERS.members), summary: col(HEADERS.summary) };
    if (ix.title < 0) throw new AppError('VALIDATION_FAILED', 'Missing a "title" column · download the template');
    return body
      .filter((r) => r.some((c) => c.trim()))
      .map((r) => ({
        title: r[ix.title] ?? '',
        category: ix.category >= 0 ? r[ix.category]?.trim() || null : null,
        memberEmails: ix.members >= 0 ? (r[ix.members] ?? '').split(/[\s,;]+/).filter(Boolean) : [],
        summary: ix.summary >= 0 ? r[ix.summary]?.trim() || null : null,
      }));
  }
}

/** RFC 4180: quoted fields, escaped quotes, newlines inside quotes */
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}
