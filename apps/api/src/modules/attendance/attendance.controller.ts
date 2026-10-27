import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Access, EventAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.guard.js';
import { AttendanceDto, FormDto, FormResponseDto, HallTicketDto, SurveyResponseDto } from '../../common/dto.js';
import { AppError } from '../../common/problem.js';
import { AttendanceService } from './attendance.service.js';

class FormKindParam extends createZodDto(z.object({ kind: z.enum(['join', 'survey']) })) {}
const toKind = (k: string): 'JOIN' | 'SURVEY' => (k === 'join' ? 'JOIN' : 'SURVEY');

@ApiTags('attendance')
@Controller('events/:eventId')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Put('interest')
  @EventAccess('USER')
  @HttpCode(204)
  async interest(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    await this.attendance.setInterest(ctx, user, true);
  }

  @Delete('interest')
  @EventAccess('USER')
  @HttpCode(204)
  async uninterest(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    await this.attendance.setInterest(ctx, user, false);
  }

  @Get('forms/:kind')
  @EventAccess('USER')
  @ZodResponse({ type: FormResponseDto })
  form(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param() p: FormKindParam) {
    return this.attendance.form(ctx, toKind(p.kind), user.id);
  }

  @Put('forms/:kind')
  @EventAccess('ADMIN')
  @ZodResponse({ type: FormResponseDto })
  putForm(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param() p: FormKindParam, @Body() body: FormDto) {
    return this.attendance.putForm(ctx, user, toKind(p.kind), body.fields);
  }

  @Post('attendances')
  @EventAccess('USER')
  @HttpCode(201)
  async attend(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: AttendanceDto) {
    await this.attendance.attend(ctx, user, body);
  }

  @Post('hall-tickets')
  @EventAccess('USER')
  @ZodResponse({ type: HallTicketDto, status: 201 })
  ticket(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    return this.attendance.ticket(ctx, user);
  }

  @Post('forms/survey/responses')
  @EventAccess('ATTENDEE')
  @HttpCode(201)
  async survey(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: SurveyResponseDto) {
    if (ctx.event.status !== 'EXHIBITION' && ctx.event.status !== 'ARCHIVED') throw new AppError('INVALID_STATUS_TRANSITION', 'The survey opens after the event');
    await this.attendance.survey(ctx, user, body.answers);
  }
}
