// Writes openapi.json without listening (npm run openapi) · the web generates its typed client from it
import './load-env.js';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

process.env.OPENAPI_ONLY = '1';
const { AppModule } = await import('./app.module.js');
const { buildOpenApi } = await import('./main.js');
const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });
app.setGlobalPrefix('api/v1');
const out = new URL('../openapi.json', import.meta.url);
writeFileSync(out, JSON.stringify(buildOpenApi(app), null, 2));
await app.close();
console.log(`wrote ${out.pathname}`);
process.exit(0);
