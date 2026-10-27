import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.guard.js';
import { AcceptanceResponseDto, MeDto, MyEventDto, MyEventsQuery, MyInviteDto, NotificationDto, UnreadQuery, UpdateMeDto } from '../../common/dto.js';
import { InvitesService } from '../people/invites.service.js';
import { MeService } from './me.service.js';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly invites: InvitesService,
  ) {}

  @Get()
  @ZodResponse({ type: MeDto })
  get(@CurrentUser() user: AuthUser) {
    return this.me.get(user);
  }

  @Patch()
  @ZodResponse({ type: MeDto })
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateMeDto) {
    return this.me.update(user, body);
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.me.delete(user);
  }

  @Get('events')
  @ZodResponse({ type: [MyEventDto] })
  events(@CurrentUser() user: AuthUser, @Query() q: MyEventsQuery) {
    return this.me.events(user, q.role);
  }

  @Get('invites')
  @ZodResponse({ type: [MyInviteDto] })
  invitesList(@CurrentUser() user: AuthUser) {
    return this.invites.mine(user.id);
  }

  /** In-app accept from Home (the email link uses POST /invites/{token}/acceptances) */
  @Post('invites/:inviteId/acceptances')
  @ZodResponse({ type: AcceptanceResponseDto, status: 201 })
  acceptInvite(@CurrentUser() user: AuthUser, @Param('inviteId', ParseUUIDPipe) inviteId: string) {
    return this.invites.acceptMine(inviteId, user);
  }

  @Get('notifications')
  @ZodResponse({ type: [NotificationDto] })
  notifications(@CurrentUser() user: AuthUser, @Query() q: UnreadQuery) {
    return this.me.notifications(user, q.unread === 'true');
  }

  @Patch('notifications/:id')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.me.readNotification(user, id);
  }
}
