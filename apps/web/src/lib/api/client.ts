import createClient, { type Middleware } from 'openapi-fetch';
import { ERROR_MESSAGES, type ErrorCode, type Problem } from '@connecta/shared';
import type { paths } from './schema';

/** Problem Details from the api, thrown by every call that fails */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem,
  ) {
    super(problem.detail ?? problem.title);
  }
  get code(): ErrorCode {
    return this.problem.code;
  }
  /** User-facing text · from the code, never from server text */
  get userMessage() {
    return ERROR_MESSAGES[this.code] ?? ERROR_MESSAGES.INTERNAL;
  }
  fieldErrors() {
    return Object.fromEntries((this.problem.errors ?? []).map((e) => [e.field, e.message]));
  }
}

export function createApi(baseUrl: string, getToken: () => Promise<string | null>) {
  const client = createClient<paths>({ baseUrl });
  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
    async onResponse({ response }) {
      if (response.ok) return response;
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      const problem: Problem = body?.code ? body : { type: 'about:blank', title: response.statusText, status: response.status, code: response.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL' };
      throw new ApiError(response.status, problem);
    },
  };
  client.use(auth);
  return client;
}

export type Api = ReturnType<typeof createApi>;
