import { Body, Controller, Get, Header, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';
import { Access, EventAccess, ProjectAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/auth.guard.js';
import { AiAnswerDto, AiSummaryDto, AiQuestionDto, DryRunQuery, ImportPreviewDto } from '../../common/dto.js';
import { toCsv } from '../engagement/engagement.service.js';
import { AiService } from './ai.service.js';
import { ImportService } from './import.service.js';

@ApiTags('ai')
@Controller()
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly importer: ImportService,
  ) {}

  @Post('projects/:projectId/ai-answers')
  @ProjectAccess('ATTENDEE', 'PRESENTER', 'ADMIN')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ZodResponse({ type: AiAnswerDto, status: 201 })
  answer(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: AiQuestionDto) {
    return this.ai.answer(ctx, user, body.question);
  }

  @Get('projects/:projectId/feedback-summary')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ZodResponse({ type: AiSummaryDto })
  feedbackSummary(@Access() ctx: AccessCtx) {
    return this.ai.summarizeFeedback(ctx);
  }

  /** multipart `file` (CSV/XLSX) or JSON `{text}` (AI, Pro) · `?dryRun=true` returns the table to check first */
  @Post('events/:eventId/project-imports')
  @EventAccess('ADMIN')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ZodResponse({ type: ImportPreviewDto, status: 201 })
  import(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Query() q: DryRunQuery, @UploadedFile() file?: Express.Multer.File, @Body() body?: { text?: unknown }) {
    const text = typeof body?.text === 'string' ? body.text.slice(0, 100_000) : undefined;
    return this.importer.run(ctx, user, { file, text }, q.dryRun === 'true');
  }

  @Get('project-import-template.csv')
  @Public()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="projects-template.csv"')
  template() {
    return toCsv(['title', 'category', 'members', 'summary'], [['Mapping urban heat with open satellite data', 'Engineering', 'mika@kmutt.ac.th, ren@kmutt.ac.th', 'Greener streets where they help most']]);
  }
}
