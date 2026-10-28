import type { BrowserContext } from '@playwright/test';

const MAILPIT = process.env.MAILPIT ?? 'http://localhost:8025';

/** Real magic-link login: request the link, read it from Mailpit, follow it, keep the session cookie */
export async function login(context: BrowserContext, base: string, email: string) {
  await fetch(`${base}/api/auth/sign-in/magic-link`, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(base).origin }, body: JSON.stringify({ email, callbackURL: '/home' }) });
  let link: string | undefined;
  for (let i = 0; i < 20 && !link; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (!list.messages?.length) continue;
    const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
    link = msg.Text.match(/https?:\/\/\S+magic-link\/verify\S+/)?.[0];
  }
  if (!link) throw new Error(`no login email for ${email}`);
  const res = await fetch(link, { redirect: 'manual' });
  const host = new URL(base).hostname;
  await context.addCookies(
    res.headers.getSetCookie().map((c) => {
      const [pair] = c.split(';');
      const [name, ...v] = pair!.split('=');
      return { name: name!, value: v.join('='), domain: host, path: '/', secure: name!.startsWith('__Secure-') };
    }),
  );
}
