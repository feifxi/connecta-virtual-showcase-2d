import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';
export * from './generated/prisma/enums.js';

/** Client options with the pg driver adapter (Prisma 7) · `max` = pool size per process */
export function prismaOptions(url = process.env.DATABASE_URL, max = 10) {
  if (!url) throw new Error('DATABASE_URL is not set');
  return { adapter: new PrismaPg({ connectionString: url, max }) };
}

export function createPrisma(url = process.env.DATABASE_URL, max = 10) {
  return new PrismaClient(prismaOptions(url, max));
}
