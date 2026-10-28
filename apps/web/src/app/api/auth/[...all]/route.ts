import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

const handler = toNextJsHandler(auth);
const base = process.env.BASE_PATH ?? '';

/** Next hands route handlers the URL without basePath · Better Auth routes on the full public path */
function withBasePath(req: Request) {
  if (!base) return req;
  const url = new URL(req.url);
  if (url.pathname.startsWith(`${base}/`)) return req;
  url.pathname = `${base}${url.pathname}`;
  return new Request(url, req);
}

export const GET = (req: Request) => handler.GET(withBasePath(req));
export const POST = (req: Request) => handler.POST(withBasePath(req));
