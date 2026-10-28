import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthedRequest } from './auth/auth.guard.js';

/**
 * Rate limits per signed-in user, per IP only when anonymous · server-side renders all reach the api
 * from the web container's single IP, so an IP key would make every user share one bucket
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>) {
    const r = req as unknown as AuthedRequest;
    return r.user ? `user:${r.user.id}` : `ip:${r.ip}`;
  }
}
