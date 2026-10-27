'use client';
import { toast } from 'sonner';
import { ApiError } from './client';

/** One place that turns failures into a toast · messages come from the error code, never server text */
export function toastError(err: unknown, fallback = 'Something went wrong. Try again.') {
  if (err instanceof ApiError) toast.error(err.userMessage, err.problem.detail && err.code !== 'INTERNAL' ? { description: err.problem.detail } : undefined);
  else toast.error(fallback);
}
