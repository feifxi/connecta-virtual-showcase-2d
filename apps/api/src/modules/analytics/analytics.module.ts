import { Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module.js';
import { JudgingModule } from '../judging/judging.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({ imports: [JudgingModule, EngagementModule], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
