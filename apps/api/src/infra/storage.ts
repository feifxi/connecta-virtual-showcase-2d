import { CreateBucketCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Readable } from 'node:stream';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { env, siteUrl } from '../env.js';

const SIGNED_URL_TTL_S = 60 * 60;

/**
 * Private bucket · files are served only through signed URLs that expire (docs/data-model.md → ไฟล์)
 * The links point at the api (GET /files), which checks the signature and streams the object:
 * storage is never exposed, and the URL survives the faculty proxy's path prefix (S3 presigned URLs sign host + path)
 */
@Injectable()
export class Storage implements OnModuleInit {
  private readonly log = new Logger(Storage.name);
  private readonly s3 = new S3Client(this.config(env.S3_ENDPOINT));
  private readonly key = createHmac('sha256', env.HALL_TICKET_SECRET).update('file-links').digest();

  private config(endpoint: string) {
    return { endpoint, region: env.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } };
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET })).catch((e) => this.log.error(`bucket: ${e.message}`));
    }
  }

  put(key: string, body: Buffer, contentType: string) {
    return this.s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  /** Absolute link valid for an hour */
  async signedUrl(key: string, filename?: string) {
    const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S;
    const q = new URLSearchParams({ k: key, e: String(exp), s: this.sign(key, exp), ...(filename && { n: filename }) });
    return `${siteUrl}/api/v1/files?${q}`;
  }

  private sign(key: string, exp: number) {
    return createHmac('sha256', this.key).update(`${key}\n${exp}`).digest('base64url');
  }

  verify(key: string, exp: number, sig: string) {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const a = Buffer.from(this.sign(key, exp));
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async stream(key: string) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { body: res.Body as Readable, type: res.ContentType ?? 'application/octet-stream', length: res.ContentLength };
  }

  async deletePrefix(prefix: string) {
    let token: string | undefined;
    do {
      const list = await this.s3.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
      const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length) await this.s3.send(new DeleteObjectsCommand({ Bucket: env.S3_BUCKET, Delete: { Objects: keys } }));
      token = list.NextContinuationToken;
    } while (token);
  }

  async usageBytes() {
    let total = 0;
    let token: string | undefined;
    do {
      const list = await this.s3.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, ContinuationToken: token }));
      total += (list.Contents ?? []).reduce((n, o) => n + (o.Size ?? 0), 0);
      token = list.NextContinuationToken;
    } while (token);
    return total;
  }
}

export const keys = {
  eventCover: (eventId: string, ext: string) => `events/${eventId}/cover.${ext}`,
  projectCover: (eventId: string, projectId: string, ext: string) => `events/${eventId}/projects/${projectId}/cover.${ext}`,
  fileOriginal: (eventId: string, projectId: string, fileId: string, ext: string) => `events/${eventId}/projects/${projectId}/files/${fileId}/original.${ext}`,
  filePage: (eventId: string, projectId: string, fileId: string, n: number) => `events/${eventId}/projects/${projectId}/files/${fileId}/pages/${n}.webp`,
  event: (eventId: string) => `events/${eventId}/`,
  file: (eventId: string, projectId: string, fileId: string) => `events/${eventId}/projects/${projectId}/files/${fileId}/`,
};
