import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Access, EventAccess, ProjectAccess, type AccessCtx } from '../../common/auth/access.js';
import { AnalyticsSummaryDto, AttendancePointDto, AudienceDto, BoothStatsDto, HeatCellDto, IntervalQuery, PresenterSummaryDto } from '../../common/dto.js';
import { toCsv } from '../engagement/engagement.service.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('events/:eventId/analytics/summary')
  @EventAccess('ADMIN')
  @ZodResponse({ type: AnalyticsSummaryDto })
  summary(@Access() ctx: AccessCtx) {
    return this.analytics.summary(ctx.event);
  }

  @Get('events/:eventId/analytics/attendance')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [AttendancePointDto] })
  attendance(@Access() ctx: AccessCtx, @Query() q: IntervalQuery) {
    return this.analytics.attendance(ctx.event, q.interval);
  }

  @Get('events/:eventId/analytics/booths')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [BoothStatsDto] })
  booths(@Access() ctx: AccessCtx) {
    return this.analytics.booths(ctx.event.id);
  }

  @Get('events/:eventId/analytics/booths.csv')
  @EventAccess('ADMIN')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="booths.csv"')
  async boothsCsv(@Access() ctx: AccessCtx) {
    const rows = await this.analytics.booths(ctx.event.id);
    return toCsv(
      ['Booth', 'Project', 'Visitors', 'Avg minutes', 'Passed by', 'Screen share viewers', 'Poster viewers', 'Feedback', 'Votes', 'Score %'],
      rows.map((r) => [r.boothLabel, r.title, r.visitors, r.avgMinutes?.toFixed(1), r.passedBy, r.screenShareViews, r.posterViews, r.feedback, r.votes, r.percent?.toFixed(2)]),
    );
  }

  @Get('events/:eventId/analytics/attendance.csv')
  @EventAccess('ADMIN')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  async attendanceCsv(@Access() ctx: AccessCtx, @Query() q: IntervalQuery) {
    return toCsv(['Time (UTC)', 'Online'], (await this.analytics.attendance(ctx.event, q.interval)).map((p) => [p.at, p.online]));
  }

  @Get('events/:eventId/analytics/heatmap')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [HeatCellDto] })
  heatmap(@Access() ctx: AccessCtx) {
    return this.analytics.heatmap(ctx.event.id);
  }

  @Get('events/:eventId/analytics/audience')
  @EventAccess('ADMIN')
  @ZodResponse({ type: AudienceDto })
  audience(@Access() ctx: AccessCtx) {
    return this.analytics.audience(ctx.event.id);
  }

  @Get('projects/:projectId/summary')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @ZodResponse({ type: PresenterSummaryDto })
  presenter(@Access() ctx: AccessCtx) {
    return this.analytics.presenterSummary(ctx);
  }
}
