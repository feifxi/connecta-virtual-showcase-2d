import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';
export * from './generated/prisma/enums.js';

/** One client per process · `max` = pool size (api and realtime each hold their own pool) */
export function createPrisma(url = process.env.DATABASE_URL, max = 10) {
  if (!url) throw new Error('DATABASE_URL is not set');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max }) });
}
