/** Only same-site paths after login (no open redirects to other origins) */
export function safeNext(next: string | string[] | undefined, fallback = '/home') {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback;
  return v;
}
