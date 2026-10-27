import { Module } from '@nestjs/common';
import { HallController } from './hall.controller.js';
import { HallService } from './hall.service.js';

@Module({ controllers: [HallController], providers: [HallService] })
export class HallModule {}
