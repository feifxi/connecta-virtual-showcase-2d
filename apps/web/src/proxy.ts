import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

// Optimistic redirect only (cookie present?) · the real checks run in server components and the api
const PROTECTED = [/^\/home/, /^\/profile/, /^\/onboarding/, /^\/manage/, /^\/platform/, /^\/invite\//, /^\/e\/[^/]+\/(join|hall|my-booth|judge)/];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!PROTECTED.some((r) => r.test(path))) return NextResponse.next();
  if (getSessionCookie(req, { cookiePrefix: 'connecta' })) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|assets|.*\\..*).*)'] };
