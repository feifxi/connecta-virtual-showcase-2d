import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { jwt, magicLink } from 'better-auth/plugins';
import { prisma } from './server/db';
import { env, isProd, siteUrl } from './server/env';
import { buttonEmail, sendMail } from './server/mail';

// Better Auth runs inside Next.js at <basePath>/api/auth/* (docs/technical.md → Auth)
// Profile fields are written only by the api (PATCH /me) → input: false here, so clients can't set them through auth
const profileField = (type: 'string' | 'number' | 'date') => ({ type, required: false, input: false }) as const;

const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' as const } }),
  ...(env.MICROSOFT_CLIENT_ID && {
    // tenant "common" = work/school (e.g. @kmutt.ac.th) and personal accounts
    microsoft: { clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET, tenantId: 'common', prompt: 'select_account' as const },
  }),
};

export const auth = betterAuth({
  appName: 'Connecta',
  baseURL: env.APP_ORIGIN,
  basePath: `${env.BASE_PATH}/api/auth`,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_ORIGIN],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  advanced: {
    database: { generateId: 'uuid' },
    cookiePrefix: 'connecta',
    useSecureCookies: isProd,
    defaultCookieAttributes: { path: env.BASE_PATH || '/' },
  },
  user: {
    additionalFields: {
      displayName: profileField('string'),
      avatarPreset: profileField('number'),
      visitorType: profileField('string'),
      province: profileField('string'),
      organization: profileField('string'),
      position: profileField('string'),
      appRole: { type: 'string', required: false, input: false, defaultValue: 'USER' },
      onboardedAt: profileField('date'),
      deletedAt: profileField('date'),
    },
  },
  account: { accountLinking: { enabled: true, trustedProviders: ['google', 'microsoft'] } },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  socialProviders,
  rateLimit: { enabled: true, window: 60, max: 100, customRules: { '/sign-in/magic-link': { window: 60, max: 5 } } },
  databaseHooks: {
    user: {
      create: { before: async (user) => ({ data: { ...user, displayName: user.name || user.email.split('@')[0] } }) },
    },
    session: {
      // a deleted account can't sign back in
      create: {
        before: async (session) => {
          const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { deletedAt: true } });
          return u?.deletedAt ? false : { data: session };
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      sendMagicLink: async ({ email, url }) => {
        const mail = buttonEmail('Your login link', 'Click the button to log in to Connecta. The link works once and expires in 15 minutes.', 'Log in', url);
        await sendMail(email, 'Log in to Connecta', mail.text, mail.html);
      },
    }),
    // The api verifies this JWT through JWKS · it carries only the user id + app role, never event roles
    jwt({
      jwks: { jwksPath: '/jwks' },
      jwt: {
        issuer: siteUrl,
        audience: 'connecta-api',
        expirationTime: '15m',
        definePayload: ({ user }) => ({ appRole: (user as { appRole?: string }).appRole ?? 'USER' }),
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
