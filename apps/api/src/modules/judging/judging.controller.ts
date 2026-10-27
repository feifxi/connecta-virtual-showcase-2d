import { Body, Controller, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import { Access, AccessService, EventAccess, ProjectAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/auth.guard.js';
import {
  AwardDto,
  AwardsDto,
  JudgeAssignmentsDto,
  JudgeAssignmentsResponseDto,
  JudgeListDto,
  JudgingProgressDto,
  RemindersDto,
  ResultsDto,
  RubricDto,
  RubricResponseDto,
  ScoreSheetDto,
  ScoreSheetResponseDto,
  SheetVisibilityDto,
  SubmitSheetDto,
} from '../../common/dto.js';
import { AppError } from '../../common/problem.js';
import { Db } from '../../infra/db.js';
import { toCsv } from '../engagement/engagement.service.js';
import { JudgingService } from './judging.service.js';

@ApiTags('judging')
@Controller()
export class JudgingController {
  constructor(
    private readonly judging: JudgingService,
    private readonly access: AccessService,
    private readonly db: Db,
  ) {}

  @Get('events/:eventId/rubric')
  @EventAccess('ADMIN', 'JUDGE')
  @ZodResponse({ type: RubricResponseDto })
  rubric(@Access() ctx: AccessCtx) {
    return this.judging.rubric(ctx.event.id);
  }

  @Put('events/:eventId/rubric')
  @EventAccess('ADMIN')
  @ZodResponse({ type: RubricResponseDto })
  putRubric(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: RubricDto) {
    this.judging.module(ctx);
    return this.judging.putRubric(ctx, user, body.criteria);
  }

  @Get('events/:eventId/judge-assignments')
  @EventAccess('ADMIN')
  @ZodResponse({ type: JudgeAssignmentsResponseDto })
  assignments(@Access() ctx: AccessCtx) {
    return this.judging.assignments(ctx.event.id);
  }

  @Put('events/:eventId/judge-assignments')
  @EventAccess('ADMIN')
  @ZodResponse({ type: JudgeAssignmentsResponseDto })
  putAssignments(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: JudgeAssignmentsDto) {
    return this.judging.putAssignments(ctx, user, body.assignments);
  }

  @Get('events/:eventId/score-sheets/me')
  @EventAccess('JUDGE')
  @ZodResponse({ type: JudgeListDto })
  judgeList(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    this.judging.module(ctx);
    return this.judging.judgeList(ctx, user);
  }

  @Get('projects/:projectId/score-sheets/me')
  @ProjectAccess('JUDGE')
  @ZodResponse({ type: ScoreSheetResponseDto })
  async mySheet(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const sheet = await this.judging.mySheet(ctx, user);
    res.setHeader('ETag', this.judging.etag(sheet.version));
    return sheet;
  }

  @Put('projects/:projectId/score-sheets/me')
  @ProjectAccess('JUDGE')
  @ZodResponse({ type: ScoreSheetResponseDto })
  async save(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: ScoreSheetDto, @Headers('if-match') ifMatch: string | undefined, @Res({ passthrough: true }) res: Response) {
    const sheet = await this.judging.saveSheet(ctx, user, body, ifMatch);
    res.setHeader('ETag', this.judging.etag(sheet.version));
    return sheet;
  }

  @Patch('projects/:projectId/score-sheets/me')
  @ProjectAccess('JUDGE')
  @ZodResponse({ type: ScoreSheetResponseDto })
  submit(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() _body: SubmitSheetDto) {
    return this.judging.submitSheet(ctx, user);
  }

  @Patch('score-sheets/:sheetId')
  @HttpCode(204)
  async visibility(@CurrentUser() user: AuthUser, @Param('sheetId', ParseUUIDPipe) sheetId: string, @Body() body: SheetVisibilityDto) {
    const s = await this.db.scoreSheet.findUnique({ where: { id: sheetId }, select: { projectId: true } });
    if (!s) throw new AppError('NOT_FOUND');
    const ctx = await this.access.forProject(s.projectId, user);
    this.access.check(ctx, ['ADMIN'], 'project');
    await this.judging.setCommentVisible(sheetId, user, body.commentVisible, ctx.event.id);
  }

  @Get('events/:eventId/judging-progress')
  @EventAccess('ADMIN')
  @ZodResponse({ type: JudgingProgressDto })
  progress(@Access() ctx: AccessCtx) {
    return this.judging.progress(ctx.event.id);
  }

  @Post('events/:eventId/judging-reminders')
  @EventAccess('ADMIN')
  @ZodResponse({ type: RemindersDto, status: 202 })
  remind(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    return this.judging.remind(ctx, user);
  }

  @Get('events/:eventId/results')
  @EventAccess('ADMIN')
  @ZodResponse({ type: ResultsDto })
  results(@Access() ctx: AccessCtx) {
    return this.judging.results(ctx.event.id);
  }

  @Get('events/:eventId/results.csv')
  @EventAccess('ADMIN')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="results.csv"')
  async resultsCsv(@Access() ctx: AccessCtx) {
    const r = await this.judging.results(ctx.event.id);
    return toCsv(
      ['Rank', 'Booth', 'Project', 'Category', 'Score %', 'Sheets', ...r.criteria.map((c) => `${c.name} %`), 'Votes'],
      r.projects.map((p, i) => [i + 1, p.boothLabel, p.title, p.category, p.percent?.toFixed(2), p.sheets, ...r.criteria.map((c) => p.perCriterion[c.id]?.toFixed(2)), p.votes]),
    );
  }

  @Post('events/:eventId/awards')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [AwardDto], status: 201 })
  announce(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: AwardsDto) {
    return this.judging.announce(ctx, user, body.judgesTop, body.audienceTop);
  }

  /** Public after the announcement only · scores never leak before (checked here, not in the UI) */
  @Get('events/:eventId/awards')
  @Public()
  @EventAccess('PUBLIC')
  @ZodResponse({ type: [AwardDto] })
  awards(@Access() ctx: AccessCtx) {
    if (!ctx.event.resultsAnnouncedAt && !ctx.isAdmin) return [];
    return this.judging.awards(ctx.event.id);
  }
}
