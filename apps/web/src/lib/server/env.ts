import 'server-only';
import { z } from 'zod';

// Fail fast on boot when the root .env is incomplete
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z.url(),
  BASE_PATH: z.string().default(''),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  SMTP_URL: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  API_INTERNAL_URL: z.url(),
});

// `next build` imports server modules without runtime secrets (Docker build) · validation runs when the server starts
const building = process.env.NEXT_PHASE === 'phase-production-build';
export const env = building
  ? schema.parse({ APP_ORIGIN: 'http://build.invalid', DATABASE_URL: 'postgresql://build', BETTER_AUTH_SECRET: 'x'.repeat(32), SMTP_URL: 'smtp://build', MAIL_FROM: 'build', API_INTERNAL_URL: 'http://build.invalid', ...process.env })
  : schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
/** Public URL of the site including the base path, e.g. https://host/capstone26/CP26SSI3 */
export const siteUrl = `${env.APP_ORIGIN}${env.BASE_PATH}`;
