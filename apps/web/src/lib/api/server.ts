import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { env } from '@/lib/server/env';
import { createApi } from './client';

// Server Components call the api directly (no nginx hop) with the user's JWT
const getToken = cache(async () => {
  try {
    const { token } = await auth.api.getToken({ headers: await headers() });
    return token;
  } catch {
    return null;
  }
});

export const serverApi = () => createApi(env.API_INTERNAL_URL, getToken);
