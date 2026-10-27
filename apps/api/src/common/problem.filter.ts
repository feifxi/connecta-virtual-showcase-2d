import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ERROR_MESSAGES, type ErrorCode, type Problem } from '@connecta/shared';
import { Prisma } from '@connecta/db';
import { AppError } from './problem.js';

const BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN_ROLE',
  404: 'NOT_FOUND',
  409: 'ALREADY_EXISTS',
  413: 'FILE_TOO_LARGE',
  415: 'UNSUPPORTED_FILE',
  429: 'RATE_LIMITED',
};

/** Every error leaves the api as application/problem+json with a stable `code` (docs/api.md → Error) */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly log = new Logger('ProblemFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const problem = this.toProblem(exception);
    if (problem.status >= 500) this.log.error(exception instanceof Error ? exception.stack : exception);
    if (problem.code === 'RATE_LIMITED') res.setHeader('Retry-After', '60');
    if (typeof problem.retryAfter === 'number') res.setHeader('Retry-After', String(problem.retryAfter));
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(e: unknown): Problem {
    const make = (code: ErrorCode, status: number, detail?: string, extra: Record<string, unknown> = {}): Problem => ({
      type: `/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title: ERROR_MESSAGES[code],
      status,
      code,
      ...(detail && detail !== code ? { detail } : {}),
      ...extra,
    });
    if (e instanceof AppError) return make(e.code, e.getStatus(), e.detail, e.extra);
    if (e instanceof ZodValidationException) {
      const zodError = e.getZodError();
      const errors = zodError instanceof ZodError ? zodError.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) : [];
      return make('VALIDATION_FAILED', 400, undefined, { errors });
    }
    if (e instanceof ThrottlerException) return make('RATE_LIMITED', 429);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return make('ALREADY_EXISTS', 409);
      if (e.code === 'P2025') return make('NOT_FOUND', 404);
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      return make(BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED'), status, e.message);
    }
    return make('INTERNAL', 500);
  }
}
