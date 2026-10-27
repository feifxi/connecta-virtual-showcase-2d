'use client';
import { api } from './browser';

/** multipart upload through the typed client (the api checks the real file type from its bytes) */
export const multipart = (file: File) => {
  const body = new FormData();
  body.append('file', file);
  return { body: body as never, bodySerializer: (b: unknown) => b as FormData };
};

export { api };
