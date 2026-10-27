import './load-env.js';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { env } from './env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.set('trust proxy', 1); // behind nginx · real client IP for rate limits
  app.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.useBodyParser('json', { limit: '1mb' });

  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Connecta API').setVersion('1').addBearerAuth().build());
  SwaggerModule.setup('api/v1/docs', app, cleanupOpenApiDoc(doc), { jsonDocumentUrl: 'api/v1/openapi.json' });

  await app.listen(env.API_PORT);
  Logger.log(`api listening on :${env.API_PORT}`, 'Bootstrap');
}

void bootstrap();
