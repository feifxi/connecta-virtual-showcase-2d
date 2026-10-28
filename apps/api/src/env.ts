import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.url(),
  BASE_PATH: z.string().default(''),
  DATABASE_URL: z.string().min(1),
  /** where the api fetches Better Auth's JWKS (web container, internal network) */
  AUTH_JWKS_URL: z.url().optional(),
  WEB_INTERNAL_URL: z.url().default('http://localhost:3000'),
  HALL_TICKET_SECRET: z.string().min(16),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PUBLIC_REALTIME_URL: z.string().min(1),
  LIVEKIT_URL: z.string().min(1),
  /** URL browsers use for LiveKit (prod: wss://media.<host>) · defaults to LIVEKIT_URL */
  PUBLIC_LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default('connecta'),
  SMTP_URL: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('claude-opus-5-5'),
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
export const siteUrl = `${env.APP_ORIGIN}${env.BASE_PATH}`;
export const jwksUrl = env.AUTH_JWKS_URL ?? `${env.WEB_INTERNAL_URL}${env.BASE_PATH}/api/auth/jwks`;
