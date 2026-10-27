import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthGuard } from './common/auth/auth.guard.js';
import { CommonModule } from './common/common.module.js';
import { ProblemFilter } from './common/problem.filter.js';
import { InfraModule } from './infra/infra.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { HallModule } from './modules/hall/hall.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { EngagementModule } from './modules/engagement/engagement.module.js';
import { JudgingModule } from './modules/judging/judging.module.js';
import { LiveModule } from './modules/live/live.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { MeModule } from './modules/me/me.module.js';
import { PeopleModule } from './modules/people/people.module.js';

@Module({
  imports: [
    InfraModule,
    CommonModule,
    ScheduleModule.forRoot(),
    // per IP · stricter limits sit on single routes (invites, AI, reports)
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    MeModule,
    PeopleModule,
    EventsModule,
    AttendanceModule,
    HallModule,
    ProjectsModule,
    LiveModule,
    EngagementModule,
    JudgingModule,
    AnalyticsModule,
    AiModule,
    PlatformModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
