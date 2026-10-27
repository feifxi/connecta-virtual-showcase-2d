import { existsSync } from 'node:fs';
import { z } from 'zod';

// Dev: the repo-root .env · prod: docker compose env
const file = new URL('../../../.env', import.meta.url);
if (existsSync(file)) process.loadEnvFile(file);

export const env = z
  .object({
    REALTIME_PORT: z.coerce.number().default(2567),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    HALL_TICKET_SECRET: z.string().min(16),
    LIVEKIT_URL: z.string().min(1),
    LIVEKIT_API_KEY: z.string().min(1),
    LIVEKIT_API_SECRET: z.string().min(1),
    MAX_CLIENTS_PER_HALL: z.coerce.number().default(1000),
  })
  .parse(process.env);
