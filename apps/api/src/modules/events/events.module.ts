import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { LifecycleModule } from '../lifecycle/lifecycle.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({ imports: [AttendanceModule, LifecycleModule], controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
