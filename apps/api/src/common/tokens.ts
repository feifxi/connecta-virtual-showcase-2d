import { createHash, randomBytes } from 'node:crypto';

/** Invite links carry a random token · only its hash is stored */
export function newToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
