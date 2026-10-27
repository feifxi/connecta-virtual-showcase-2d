import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Access, EventAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.guard.js';
import { HallDto, HallPresetDto, PlacementsDto } from '../../common/dto.js';
import { HallService } from './hall.service.js';

@ApiTags('hall')
@Controller('events/:eventId/hall')
export class HallController {
  constructor(private readonly hall: HallService) {}

  @Get()
  @EventAccess('ATTENDEE', 'ADMIN')
  @ZodResponse({ type: HallDto })
  get(@Access() ctx: AccessCtx) {
    return this.hall.get(ctx.event.id);
  }

  @Patch()
  @EventAccess('ADMIN')
  @ZodResponse({ type: HallDto })
  preset(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: HallPresetDto) {
    return this.hall.setPreset(ctx, user, body.preset);
  }

  @Put('placements')
  @EventAccess('ADMIN')
  @ZodResponse({ type: HallDto })
  placements(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: PlacementsDto) {
    return this.hall.setPlacements(ctx, user, body.placements);
  }

  @Post('arrangements')
  @EventAccess('ADMIN')
  @ZodResponse({ type: HallDto, status: 201 })
  arrange(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    return this.hall.autoArrange(ctx, user);
  }
}
