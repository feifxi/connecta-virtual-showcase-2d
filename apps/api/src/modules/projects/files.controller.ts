import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Public } from '../../common/auth/auth.guard.js';
import { AppError } from '../../common/problem.js';
import { Storage } from '../../infra/storage.js';

class FileQuery extends createZodDto(z.object({ k: z.string().max(400), e: z.coerce.number(), s: z.string().max(100), n: z.string().max(200).optional() })) {}

/** Serves a stored file for a link the api signed (an hour) · the access decision was made when the link was issued */
@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: Storage) {}

  @Get()
  @Public()
  async get(@Query() q: FileQuery, @Res() res: Response) {
    if (!this.storage.verify(q.k, q.e, q.s)) throw new AppError('NOT_FOUND', 'Link expired or invalid');
    const file = await this.storage.stream(q.k).catch(() => null);
    if (!file) throw new AppError('NOT_FOUND');
    res.setHeader('Content-Type', file.type);
    if (file.length) res.setHeader('Content-Length', String(file.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // never render uploads inline as active content
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Content-Disposition', `${file.type.startsWith('image/') || file.type === 'application/pdf' ? 'inline' : 'attachment'}; filename="${(q.n ?? 'file').replace(/[^\w.\- ]/g, '_')}"`);
    file.body.pipe(res);
  }
}
