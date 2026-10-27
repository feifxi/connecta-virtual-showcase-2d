import './load-env.js';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { z } from 'zod';
import * as dtos from './common/dto.js';
import { AppModule } from './app.module.js';
import { env } from './env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.set('trust proxy', 1); // behind nginx · real client IP for rate limits
  app.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.useBodyParser('json', { limit: '1mb' });

  SwaggerModule.setup('api/v1/docs', app, buildOpenApi(app), { jsonDocumentUrl: 'api/v1/openapi.json' });

  await app.listen(env.API_PORT);
  Logger.log(`api listening on :${env.API_PORT}`, 'Bootstrap');
}

/** The OpenAPI 3.1 document the web client types are generated from */
export function buildOpenApi(app: NestExpressApplication) {
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setOpenAPIVersion('3.1.0').setTitle('Connecta API').setVersion('1').addBearerAuth().build());
  return withZodSchemas(withOkResponses(cleanupOpenApiDoc(doc)));
}

/** Routes without an explicit status document their body as `default` · typed clients expect a 2xx key and every path param */
function withOkResponses(doc: OpenAPIObject) {
  for (const [path, ops] of Object.entries(doc.paths))
    for (const op of Object.values(ops as Record<string, { responses?: Record<string, unknown>; parameters?: { name: string; in: string }[] }>)) {
      // params read by the access guard (not @Param) still belong in the spec
      for (const name of path.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? []) {
        op.parameters ??= [];
        if (!op.parameters.some((p) => p.name === name && p.in === 'path')) op.parameters.push({ name, in: 'path', required: true, schema: { type: 'string' } } as never);
      }
      const r = op?.responses;
      if (r?.default && !Object.keys(r).some((k) => k.startsWith('2'))) {
        r['200'] = r.default;
        delete r.default;
      }
    }
  return doc;
}

/**
 * @nestjs/swagger 11.4 turns zod's `type: [T, "null"]` into an array before nestjs-zod can clean it up,
 * so every shared DTO's component is replaced with zod's own JSON Schema (OpenAPI 3.1 = JSON Schema 2020-12)
 */
function withZodSchemas(doc: OpenAPIObject) {
  const schemas = doc.components?.schemas ?? {};
  for (const [name, dto] of Object.entries(dtos)) {
    const schema = (dto as { schema?: z.ZodType }).schema;
    if (!schema) continue;
    if (schemas[name]) schemas[name] = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as never;
    if (schemas[`${name}_Output`]) schemas[`${name}_Output`] = z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' }) as never;
  }
  return doc;
}

if (!process.env.OPENAPI_ONLY) void bootstrap();
