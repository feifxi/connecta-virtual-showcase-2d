import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { GateService } from './gate.service.js';

@Module({ controllers: [AttendanceController], providers: [AttendanceService, GateService], exports: [GateService] })
export class AttendanceModule {}
