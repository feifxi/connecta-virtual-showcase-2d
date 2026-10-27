import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';
import { Access, EventAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.guard.js';
import { AnnouncementDto, HallSettingsDto, MicrophoneDto, ReportDto, ReportResponseDto, ReportStatusDto, StatusQuery } from '../../common/dto.js';
import { LiveService } from './live.service.js';

@ApiTags('hall-live')
@Controller('events/:eventId')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Put('hall/participants/:userId/microphone')
  @EventAccess('PRESENTER', 'ADMIN')
  @HttpCode(204)
  async mute(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() body: MicrophoneDto) {
    await this.live.mute(ctx, user, userId, body.muted);
  }

  @Delete('hall/participants/:userId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async kick(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.live.kick(ctx, user, userId);
  }

  @Patch('hall/settings')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async settings(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: HallSettingsDto) {
    await this.live.settings(ctx, user, body);
  }

  @Post('announcements')
  @EventAccess('ADMIN')
  @HttpCode(202)
  async announce(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: AnnouncementDto) {
    await this.live.announce(ctx, user, body.text);
  }

  @Post('reports')
  @EventAccess('ATTENDEE')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(201)
  async report(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: ReportDto) {
    await this.live.report(ctx, user, body);
  }

  @Get('reports')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [ReportResponseDto] })
  reports(@Access() ctx: AccessCtx, @Query() q: StatusQuery) {
    return this.live.reports(ctx.event.id, q.status as 'OPEN' | undefined);
  }

  @Patch('reports/:reportId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async reportStatus(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('reportId', ParseUUIDPipe) reportId: string, @Body() body: ReportStatusDto) {
    await this.live.setReportStatus(ctx.event.id, user, reportId, body.status);
  }
}
