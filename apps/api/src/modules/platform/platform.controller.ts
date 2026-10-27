import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.guard.js';
import { PlatformEventDto, PlatformHealthDto } from '../../common/dto.js';
import { eventCardInclude, iso, isoOrNull, toEventCard } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { Media } from '../../infra/media.js';
import { Storage } from '../../infra/storage.js';

class PlatformEventPatch extends createZodDto(z.object({ suspended: z.boolean().optional(), plan: z.enum(['FREE', 'PRO']).optional(), reason: z.string().max(300).default('') })) {}

/** Platform Console: our team only · never enters an event's hall · every action shows in that event's audit log */
@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
    private readonly media: Media,
    private readonly audit: Audit,
    private readonly bus: HallBus,
  ) {}

  private guard(user: AuthUser) {
    if (user.appRole !== 'PLATFORM_ADMIN') throw new AppError('FORBIDDEN_ROLE');
  }

  @Get('events')
  @ZodResponse({ type: [PlatformEventDto] })
  async events(@CurrentUser() user: AuthUser) {
    this.guard(user);
    const rows = await this.db.event.findMany({ include: { ...eventCardInclude, members: { where: { roles: { has: 'ADMIN' } }, include: { user: { select: { email: true } } } } }, orderBy: { createdAt: 'desc' }, take: 500 });
    return Promise.all(rows.map(async (e) => ({ ...(await toEventCard(e, this.storage)), suspendedAt: isoOrNull(e.suspendedAt), createdAt: iso(e.createdAt), adminEmails: e.members.map((m) => m.user.email) })));
  }

  @Patch('events/:eventId')
  @HttpCode(204)
  async update(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @Body() body: PlatformEventPatch) {
    this.guard(user);
    await this.db.event.update({
      where: { id: eventId },
      data: { ...(body.suspended !== undefined && { suspendedAt: body.suspended ? new Date() : null }), ...(body.plan && { plan: body.plan }) },
    });
    if (body.suspended) await this.bus.publish(eventId, { type: 'kick', userId: '*', reason: 'This event was suspended by the platform team', banned: false });
    await this.audit.log(eventId, user.id, body.suspended !== undefined ? (body.suspended ? 'platform.suspend' : 'platform.unsuspend') : 'platform.plan', eventId, { plan: body.plan ?? null }, body.reason);
  }

  @Get('health')
  @ZodResponse({ type: PlatformHealthDto })
  async health(@CurrentUser() user: AuthUser) {
    this.guard(user);
    const [online, liveEvents, rooms, storageBytes, livekit, db] = await Promise.all([
      this.db.presenceSession.count({ where: { leftAt: null } }),
      this.db.event.count({ where: { status: 'LIVE' } }),
      this.db.presenceSession.findMany({ where: { leftAt: null }, select: { eventId: true }, distinct: ['eventId'] }),
      this.storage.usageBytes().catch(() => 0),
      this.media.health(),
      this.db.$queryRaw`SELECT 1`.then(() => ({ ok: true })).catch(() => ({ ok: false })),
    ]);
    return { online, liveEvents, rooms: rooms.length, storageBytes, livekit, db };
  }
}
