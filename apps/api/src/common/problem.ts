import { HttpException } from '@nestjs/common';
import { ERROR_STATUS, type ErrorCode } from '@connecta/shared';

/** Throw from anywhere · becomes an RFC 9457 problem+json response with this code */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly detail?: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(detail ?? code, ERROR_STATUS[code]);
  }
}

export const notFound = (detail?: string) => new AppError('NOT_FOUND', detail);
export const forbidden = (detail?: string) => new AppError('FORBIDDEN_ROLE', detail);
