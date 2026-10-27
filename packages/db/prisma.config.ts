import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: new URL('../../.env', import.meta.url).pathname });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx src/seed.ts' },
  datasource: { url: process.env.DATABASE_URL! },
});
