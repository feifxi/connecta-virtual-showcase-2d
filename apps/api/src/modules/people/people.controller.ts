import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Access, EventAccess, ProjectAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.guard.js';
import {
  AcceptanceResponseDto,
  AuditLogDto,
  BanDto,
  BanResponseDto,
  CreateInvitesDto,
  InviteDto,
  InviteLookupDto,
  InviteResultDto,
  InviteStatusDto,
  MembersDto,
  ProjectInviteDto,
  SetRolesDto,
  StatusQuery,
} from '../../common/dto.js';
import { InvitesService } from './invites.service.js';
import { MembersService } from './members.service.js';

@ApiTags('people')
@Controller()
export class PeopleController {
  constructor(
    private readonly members: MembersService,
    private readonly invites: InvitesService,
  ) {}

  @Get('events/:eventId/members')
  @EventAccess('ADMIN')
  @ZodResponse({ type: MembersDto })
  listMembers(@Access() ctx: AccessCtx) {
    return this.members.list(ctx);
  }

  @Put('events/:eventId/members/:userId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async setRoles(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() body: SetRolesDto) {
    await this.members.setRoles(ctx, user, userId, body.roles);
  }

  @Delete('events/:eventId/members/:userId')
  @EventAccess('USER')
  @HttpCode(204)
  async removeMember(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.members.remove(ctx, user, userId);
  }

  @Get('events/:eventId/invites')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [InviteDto] })
  listInvites(@Access() ctx: AccessCtx, @Query() q: StatusQuery) {
    return this.invites.list(ctx.event.id, q.status);
  }

  @Post('events/:eventId/invites')
  @EventAccess('ADMIN')
  @ZodResponse({ type: InviteResultDto, status: 202 })
  createInvites(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: CreateInvitesDto) {
    return this.invites.create(ctx, user, body.emails, body.roles, body.projectId);
  }

  @Patch('events/:eventId/invites/:inviteId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async revokeInvite(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('inviteId', ParseUUIDPipe) inviteId: string, @Body() _body: InviteStatusDto) {
    await this.invites.revoke(ctx.event.id, inviteId, user.id);
  }

  @Post('projects/:projectId/invites')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @ZodResponse({ type: InviteResultDto, status: 202 })
  inviteTeammates(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: ProjectInviteDto) {
    return this.invites.createForProject(ctx, user, body.emails);
  }

  @Get('invites/:token')
  @ZodResponse({ type: InviteLookupDto })
  lookup(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.invites.lookup(token, user);
  }

  @Post('invites/:token/acceptances')
  @ZodResponse({ type: AcceptanceResponseDto, status: 201 })
  accept(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.invites.acceptToken(token, user);
  }

  @Get('events/:eventId/bans')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [BanResponseDto] })
  listBans(@Access() ctx: AccessCtx) {
    return this.members.bans(ctx.event.id);
  }

  @Put('events/:eventId/bans/:userId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async ban(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() body: BanDto) {
    await this.members.ban(ctx, user, userId, body.reason);
  }

  @Delete('events/:eventId/bans/:userId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async unban(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.members.unban(ctx.event.id, user, userId);
  }

  @Get('events/:eventId/audit-logs')
  @EventAccess('ADMIN')
  @ZodResponse({ type: [AuditLogDto] })
  auditLogs(@Access() ctx: AccessCtx) {
    return this.members.auditLogs(ctx.event.id);
  }
}
