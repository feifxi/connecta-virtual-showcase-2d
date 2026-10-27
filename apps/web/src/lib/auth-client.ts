'use client';
import { createAuthClient } from 'better-auth/react';
import { jwtClient, magicLinkClient } from 'better-auth/client/plugins';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const authClient = createAuthClient({
  basePath: `${basePath}/api/auth`,
  plugins: [magicLinkClient(), jwtClient()],
});

export const { useSession, signIn, signOut } = authClient;
