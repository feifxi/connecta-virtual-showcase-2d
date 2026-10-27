import { CreateBucketCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { env } from '../env.js';

const SIGNED_URL_TTL_S = 60 * 60;

/** Private bucket · files are served only through signed URLs that expire (docs/data-model.md → ไฟล์) */
@Injectable()
export class Storage implements OnModuleInit {
  private readonly log = new Logger(Storage.name);
  private readonly s3 = new S3Client(this.config(env.S3_ENDPOINT));
  // signing doesn't call the network, so a client pointed at the public endpoint produces browser-usable URLs
  private readonly signer = new S3Client(this.config(env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT));

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

  signedUrl(key: string, filename?: string) {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ...(filename && { ResponseContentDisposition: `inline; filename="${filename.replace(/"/g, '')}"` }) }),
      { expiresIn: SIGNED_URL_TTL_S },
    );
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
