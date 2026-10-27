import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { IMAGE_RULE } from '@connecta/shared';
import { Access, EventAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/auth.guard.js';
import {
  CategoryDto,
  CategoryResponseDto,
  ConfirmQuery,
  CreateEventDto,
  EventCardPageDto,
  EventDetailDto,
  ExploreQuery,
  SlugDto,
  UpdateCategoryDto,
  UpdateEventDto,
} from '../../common/dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  @Public()
  @ZodResponse({ type: EventCardPageDto })
  explore(@Query() q: ExploreQuery) {
    return this.events.explore(q);
  }

  @Get('slugs/:slug')
  @Public()
  @ZodResponse({ type: SlugDto })
  slug(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.events.resolveSlug(slug, user);
  }

  @Post('events')
  @ZodResponse({ type: SlugDto, status: 201 })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateEventDto) {
    return this.events.create(user, body);
  }

  @Get('events/:eventId')
  @Public()
  @EventAccess('PUBLIC')
  @ZodResponse({ type: EventDetailDto })
  detail(@Access() ctx: AccessCtx) {
    return this.events.detail(ctx);
  }

  @Patch('events/:eventId')
  @EventAccess('ADMIN')
  @ZodResponse({ type: EventDetailDto })
  update(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: UpdateEventDto) {
    return this.events.update(ctx, user, body);
  }

  @Delete('events/:eventId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async remove(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Query() q: ConfirmQuery) {
    await this.events.remove(ctx, user, q.confirm);
  }

  @Put('events/:eventId/cover')
  @EventAccess('ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_RULE.maxBytes + 1 } }))
  @HttpCode(204)
  async cover(@Access() ctx: AccessCtx, @UploadedFile() file: Express.Multer.File) {
    await this.events.setCover(ctx, file);
  }

  @Get('events/:eventId/categories')
  @Public()
  @EventAccess('PUBLIC')
  @ZodResponse({ type: [CategoryResponseDto] })
  categories(@Access() ctx: AccessCtx) {
    return this.events.categories(ctx.event.id);
  }

  @Post('events/:eventId/categories')
  @EventAccess('ADMIN')
  @ZodResponse({ type: CategoryResponseDto, status: 201 })
  addCategory(@Access() ctx: AccessCtx, @Body() body: CategoryDto) {
    return this.events.addCategory(ctx.event.id, body);
  }

  @Patch('events/:eventId/categories/:categoryId')
  @EventAccess('ADMIN')
  @ZodResponse({ type: CategoryResponseDto })
  updateCategory(@Access() ctx: AccessCtx, @Param('categoryId', ParseUUIDPipe) categoryId: string, @Body() body: UpdateCategoryDto) {
    return this.events.updateCategory(ctx.event.id, categoryId, body);
  }

  @Delete('events/:eventId/categories/:categoryId')
  @EventAccess('ADMIN')
  @HttpCode(204)
  async removeCategory(@Access() ctx: AccessCtx, @Param('categoryId', ParseUUIDPipe) categoryId: string) {
    await this.events.removeCategory(ctx.event.id, categoryId);
  }

  @Post('events/:eventId/copies')
  @EventAccess('ADMIN')
  @ZodResponse({ type: SlugDto, status: 201 })
  copy(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    return this.events.copy(ctx, user);
  }

  @Get('events/:eventId/calendar.ics')
  @Public()
  @EventAccess('PUBLIC')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="event.ics"')
  calendar(@Access() ctx: AccessCtx) {
    return this.events.calendar(ctx.event);
  }
}
