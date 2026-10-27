import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Access, AccessService, ProjectAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.guard.js';
import { ContactRequestDto, ContactRequestResponseDto, FeedbackDto, FeedbackResponseDto, FeedbackStatusDto, MyEngagementDto } from '../../common/dto.js';
import { AppError } from '../../common/problem.js';
import { Db } from '../../infra/db.js';
import { EngagementService, toCsv } from './engagement.service.js';

@ApiTags('engagement')
@Controller()
export class EngagementController {
  constructor(
    private readonly engagement: EngagementService,
    private readonly access: AccessService,
    private readonly db: Db,
  ) {}

  @Post('projects/:projectId/feedbacks')
  @ProjectAccess('ATTENDEE')
  @HttpCode(201)
  async addFeedback(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: FeedbackDto) {
    await this.engagement.addFeedback(ctx, user, body.text, body.isAnonymous);
  }

  @Get('projects/:projectId/feedbacks')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @ZodResponse({ type: [FeedbackResponseDto] })
  feedbacks(@Access() ctx: AccessCtx) {
    return this.engagement.listFeedback(ctx);
  }

  @Patch('feedbacks/:feedbackId')
  @HttpCode(204)
  async feedbackStatus(@CurrentUser() user: AuthUser, @Param('feedbackId', ParseUUIDPipe) feedbackId: string, @Body() body: FeedbackStatusDto) {
    const f = await this.db.feedback.findUnique({ where: { id: feedbackId }, select: { projectId: true } });
    if (!f) throw new AppError('NOT_FOUND');
    const ctx = await this.access.forProject(f.projectId, user);
    this.access.check(ctx, ['PRESENTER', 'ADMIN'], 'project');
    await this.engagement.setFeedbackStatus(feedbackId, ctx, user, body.status);
  }

  @Get('projects/:projectId/engagement/me')
  @ProjectAccess('USER')
  @ZodResponse({ type: MyEngagementDto })
  mine(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    return this.engagement.mine(ctx, user);
  }

  @Put('projects/:projectId/votes/me')
  @ProjectAccess('ATTENDEE')
  @HttpCode(204)
  async vote(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    await this.engagement.vote(ctx, user, true);
  }

  @Delete('projects/:projectId/votes/me')
  @ProjectAccess('ATTENDEE')
  @HttpCode(204)
  async unvote(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    await this.engagement.vote(ctx, user, false);
  }

  @Put('projects/:projectId/contact-requests/me')
  @ProjectAccess('ATTENDEE')
  @HttpCode(204)
  async contact(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: ContactRequestDto) {
    await this.engagement.requestContact(ctx, user, body);
  }

  @Delete('projects/:projectId/contact-requests/me')
  @ProjectAccess('ATTENDEE')
  @HttpCode(204)
  async withdraw(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    await this.engagement.withdrawContact(ctx, user);
  }

  @Get('projects/:projectId/contact-requests')
  @ProjectAccess('PRESENTER')
  @ZodResponse({ type: [ContactRequestResponseDto] })
  contacts(@Access() ctx: AccessCtx) {
    return this.engagement.contacts(ctx);
  }

  @Get('projects/:projectId/contact-requests.csv')
  @ProjectAccess('PRESENTER')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="contact-requests.csv"')
  async contactsCsv(@Access() ctx: AccessCtx) {
    const rows = await this.engagement.contacts(ctx);
    return toCsv(['Name', 'Organization', 'Email', 'Phone', 'Link', 'Message', 'Date'], rows.map((r) => [r.person.displayName, r.person.organization, r.email, r.phone, r.link, r.message, r.createdAt]));
  }
}
