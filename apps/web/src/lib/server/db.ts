import 'server-only';
import { createPrisma } from '@connecta/db';

// Reuse one pool across hot reloads in dev
const g = globalThis as unknown as { prisma?: ReturnType<typeof createPrisma> };
export const prisma = g.prisma ?? createPrisma(process.env.DATABASE_URL, 5);
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
