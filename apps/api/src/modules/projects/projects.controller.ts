import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import { IMAGE_RULE } from '@connecta/shared';
import { Access, EventAccess, ProjectAccess, type AccessCtx } from '../../common/auth/access.js';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/auth.guard.js';
import { CreateProjectDto, FileUploadQuery, PersonDto, ProjectDetailDto, ProjectFileDto, ProjectPageDto, ProjectsQuery, UpdateFileDto, UpdateProjectDto } from '../../common/dto.js';
import { personSelect, toPerson } from '../../common/mappers.js';
import { Db } from '../../infra/db.js';
import { FilesService } from './files.service.js';
import { etagOf, ProjectsService } from './projects.service.js';

const MAX_UPLOAD = 50 * 1024 * 1024 + 1;

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly files: FilesService,
    private readonly db: Db,
  ) {}

  @Get('events/:eventId/projects')
  @Public()
  @EventAccess('PUBLIC')
  @ZodResponse({ type: ProjectPageDto })
  list(@Access() ctx: AccessCtx, @Query() q: ProjectsQuery) {
    return this.projects.list(ctx.event.id, q, ctx.user);
  }

  @Post('events/:eventId/projects')
  @EventAccess('ADMIN', 'USER')
  @ZodResponse({ type: ProjectDetailDto, status: 201 })
  create(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: CreateProjectDto) {
    return this.projects.create(ctx, user, body);
  }

  @Get('projects/:projectId')
  @Public()
  @ProjectAccess('PUBLIC')
  @ZodResponse({ type: ProjectDetailDto })
  async detail(@Access() ctx: AccessCtx, @Res({ passthrough: true }) res: Response) {
    res.setHeader('ETag', etagOf(ctx.project!.version));
    return this.projects.detail(ctx);
  }

  @Patch('projects/:projectId')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @ZodResponse({ type: ProjectDetailDto })
  async update(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Body() body: UpdateProjectDto, @Headers('if-match') ifMatch: string | undefined, @Res({ passthrough: true }) res: Response) {
    const out = await this.projects.update(ctx, user, body, ifMatch);
    res.setHeader('ETag', etagOf(out.version));
    return out;
  }

  @Delete('projects/:projectId')
  @ProjectAccess('ADMIN')
  @HttpCode(204)
  async remove(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser) {
    await this.projects.remove(ctx, user);
  }

  @Put('projects/:projectId/cover')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_RULE.maxBytes + 1 } }))
  @HttpCode(204)
  async cover(@Access() ctx: AccessCtx, @UploadedFile() file: Express.Multer.File) {
    await this.projects.setCover(ctx, file);
  }

  @Get('projects/:projectId/members')
  @Public()
  @ProjectAccess('PUBLIC')
  @ZodResponse({ type: [PersonDto] })
  async members(@Access() ctx: AccessCtx) {
    const rows = await this.db.projectMember.findMany({ where: { projectId: ctx.project!.id }, include: { user: { select: personSelect } } });
    return rows.map((r) => toPerson(r.user));
  }

  @Delete('projects/:projectId/members/:userId')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @HttpCode(204)
  async removeMember(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.projects.removeMember(ctx, user, userId);
  }

  @Post('projects/:projectId/files')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD } }))
  @ZodResponse({ type: ProjectFileDto, status: 202 })
  upload(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Query() q: FileUploadQuery, @UploadedFile() file: Express.Multer.File) {
    return this.files.upload(ctx, user, q.kind, q.useForAi === 'true', file);
  }

  @Patch('projects/:projectId/files/:fileId')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @ZodResponse({ type: ProjectFileDto })
  updateFile(@Access() ctx: AccessCtx, @Param('fileId', ParseUUIDPipe) fileId: string, @Body() body: UpdateFileDto) {
    return this.files.setUseForAi(ctx, fileId, body.useForAi);
  }

  @Delete('projects/:projectId/files/:fileId')
  @ProjectAccess('PRESENTER', 'ADMIN')
  @HttpCode(204)
  async removeFile(@Access() ctx: AccessCtx, @CurrentUser() user: AuthUser, @Param('fileId', ParseUUIDPipe) fileId: string) {
    await this.files.remove(ctx, user, fileId);
  }
}
