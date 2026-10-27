'use client';
import { authClient } from '@/lib/auth-client';
import { createApi } from './client';

// JWT from Better Auth (15 min) · cached and refreshed a minute before it expires
let cached: { token: string; exp: number } | null = null;
let pending: Promise<string | null> | null = null;

async function getToken() {
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token;
  pending ??= authClient
    .token()
    .then(({ data }) => {
      if (!data?.token) return (cached = null);
      const exp = JSON.parse(atob(data.token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
      cached = { token: data.token, exp };
      return data.token;
    })
    .catch(() => null)
    .finally(() => (pending = null));
  return pending;
}

export function clearApiToken() {
  cached = null;
}

export const api = createApi(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}`, getToken);
