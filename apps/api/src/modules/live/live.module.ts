import { Module } from '@nestjs/common';
import { LiveController } from './live.controller.js';
import { LiveService } from './live.service.js';

@Module({ controllers: [LiveController], providers: [LiveService] })
export class LiveModule {}
