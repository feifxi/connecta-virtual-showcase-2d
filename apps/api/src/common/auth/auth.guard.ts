import { createParamDecorator, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { jwksUrl, siteUrl } from '../../env.js';
import { AppError } from '../problem.js';

export type AuthUser = { id: string; appRole: 'USER' | 'PLATFORM_ADMIN' };
export type AuthedRequest = Request & { user?: AuthUser };

const PUBLIC = 'auth:public';
/** No login needed · the user is still attached when a valid token is sent (e.g. Draft events for Admins) */
export const Public = () => SetMetadata(PUBLIC, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().user);

// Better Auth's JWT (EdDSA) checked against its JWKS · keys are cached and refetched on rotation
const jwks = createRemoteJWKSet(new URL(jwksUrl), { cacheMaxAge: 10 * 60_000, cooldownDuration: 30_000 });

/** Verifies the Bearer JWT · a provider so tests can swap in a fake */
@Injectable()
export class TokenVerifier {
  async verify(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: siteUrl, audience: 'connecta-api' });
      if (!payload.sub) return null;
      return { id: payload.sub, appRole: payload.appRole === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'USER' };
    } catch {
      return null;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenVerifier,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    req.user = token ? ((await this.tokens.verify(token)) ?? undefined) : undefined;
    if (!req.user && !isPublic) throw new AppError('UNAUTHENTICATED');
    return true;
  }
}

export const requireUser = (user: AuthUser | undefined): AuthUser => {
  if (!user) throw new AppError('UNAUTHENTICATED');
  return user;
};
