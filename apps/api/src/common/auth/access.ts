import { applyDecorators, createParamDecorator, Injectable, SetMetadata, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Event, EventRole, Project } from '@connecta/db';
import { Db } from '../../infra/db.js';
import { AppError } from '../problem.js';
import type { AuthedRequest, AuthUser } from './auth.guard.js';

/**
 * Who may call a route · permissions are the union of all roles, never a hierarchy (docs/features.md → 4.1)
 * On event routes PRESENTER / JUDGE = has that role in the event.
 * On project routes PRESENTER = presenter of this project · JUDGE = judge assigned to this project.
 * ATTENDEE = filled in the join form · USER = logged in · PUBLIC = anyone (event must be visible).
 * Event roles are read from the DB on every request (the JWT never carries them).
 */
export type Grant = 'ADMIN' | 'PRESENTER' | 'JUDGE' | 'ATTENDEE' | 'USER' | 'PUBLIC';

export type AccessCtx = {
  user: AuthUser | undefined;
  event: Event;
  roles: Set<EventRole>;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  attendee: boolean;
  banned: boolean;
  project?: Project;
  isPresenterOf: boolean;
  isJudgeOf: boolean;
};

type AccessReq = AuthedRequest & { access?: AccessCtx };

@Injectable()
export class AccessService {
  constructor(private readonly db: Db) {}

  async forEvent(eventId: string, user: AuthUser | undefined, projectId?: string): Promise<AccessCtx> {
    if (!isUuid(eventId)) throw new AppError('NOT_FOUND');
    const event = await this.db.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError('NOT_FOUND');
    const [member, attendee, ban] = user
      ? await Promise.all([
          this.db.eventMember.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } }),
          this.db.eventAttendee.findUnique({ where: { eventId_userId: { eventId, userId: user.id } }, select: { userId: true } }),
          this.db.eventBan.findUnique({ where: { eventId_userId: { eventId, userId: user.id } }, select: { userId: true } }),
        ])
      : [null, null, null];
    const roles = new Set(member?.roles ?? []);
    const isAdmin = roles.has('ADMIN');
    const isPlatformAdmin = user?.appRole === 'PLATFORM_ADMIN';
    // Draft and suspended events don't exist for anyone but their Admins (and the platform team)
    if ((event.status === 'DRAFT' || event.suspendedAt) && !isAdmin && !isPlatformAdmin) throw new AppError('NOT_FOUND');

    const ctx: AccessCtx = { user, event, roles, isAdmin, isPlatformAdmin, attendee: !!attendee, banned: !!ban, isPresenterOf: false, isJudgeOf: false };
    if (projectId) {
      const project = await this.db.project.findUnique({ where: { id: projectId } });
      if (!project || project.eventId !== eventId) throw new AppError('NOT_FOUND');
      ctx.project = project;
      if (user) {
        ctx.isPresenterOf = roles.has('PRESENTER') && !!(await this.db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } }));
        ctx.isJudgeOf = roles.has('JUDGE') && (await this.isAssigned(eventId, user.id, projectId));
      }
    }
    return ctx;
  }

  async forProject(projectId: string, user: AuthUser | undefined) {
    if (!isUuid(projectId)) throw new AppError('NOT_FOUND');
    const p = await this.db.project.findUnique({ where: { id: projectId }, select: { eventId: true } });
    if (!p) throw new AppError('NOT_FOUND');
    return this.forEvent(p.eventId, user, projectId);
  }

  /** No assignment rows in the event = every judge judges every project */
  async isAssigned(eventId: string, judgeId: string, projectId: string) {
    const any = await this.db.judgeAssignment.count({ where: { eventId } });
    if (!any) return true;
    return !!(await this.db.judgeAssignment.findUnique({ where: { judgeId_projectId: { judgeId, projectId } } }));
  }

  check(ctx: AccessCtx, grants: Grant[], scope: 'event' | 'project') {
    const ok = grants.some((g) => {
      switch (g) {
        case 'PUBLIC':
          return true;
        case 'USER':
          return !!ctx.user;
        case 'ADMIN':
          return ctx.isAdmin;
        case 'ATTENDEE':
          return ctx.attendee;
        case 'PRESENTER':
          return scope === 'project' ? ctx.isPresenterOf : ctx.roles.has('PRESENTER');
        case 'JUDGE':
          return scope === 'project' ? ctx.isJudgeOf : ctx.roles.has('JUDGE');
      }
    });
    if (!ok) {
      if (!ctx.user && !grants.includes('PUBLIC')) throw new AppError('UNAUTHENTICATED');
      if (grants.includes('ATTENDEE') && ctx.user && !ctx.attendee) throw new AppError('JOIN_FORM_REQUIRED');
      if (grants.includes('JUDGE') && scope === 'project' && ctx.roles.has('JUDGE')) throw new AppError('NOT_ASSIGNED');
      throw new AppError('FORBIDDEN_ROLE');
    }
    // banned people keep read access to public pages only
    if (ctx.banned && !ctx.isAdmin && !grants.includes('PUBLIC')) throw new AppError('BANNED');
  }
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const GRANTS = 'access:grants';
const SCOPE = 'access:scope';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const grants = this.reflector.get<Grant[]>(GRANTS, ctx.getHandler());
    const scope = this.reflector.get<'event' | 'project'>(SCOPE, ctx.getHandler());
    const req = ctx.switchToHttp().getRequest<AccessReq>();
    const access =
      scope === 'project' ? await this.access.forProject(String(req.params.projectId), req.user) : await this.access.forEvent(String(req.params.eventId), req.user);
    this.access.check(access, grants, scope);
    req.access = access;
    return true;
  }
}

/** Route under /events/:eventId · e.g. @EventAccess('ADMIN') */
export const EventAccess = (...grants: Grant[]) => applyDecorators(SetMetadata(GRANTS, grants), SetMetadata(SCOPE, 'event'), UseGuards(AccessGuard));
/** Route under /projects/:projectId · e.g. @ProjectAccess('PRESENTER', 'ADMIN') */
export const ProjectAccess = (...grants: Grant[]) => applyDecorators(SetMetadata(GRANTS, grants), SetMetadata(SCOPE, 'project'), UseGuards(AccessGuard));
/** The AccessCtx loaded by the guard */
export const Access = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AccessReq>().access!);
