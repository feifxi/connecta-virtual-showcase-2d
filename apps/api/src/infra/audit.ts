import { Injectable } from '@nestjs/common';
import type { Prisma } from '@connecta/db';
import { Db } from './db.js';

/** Every use of power is logged (docs/features.md → กฎร่วม) · analytics events feed the post-event report */
@Injectable()
export class Audit {
  constructor(private readonly db: Db) {}

  log(eventId: string | null, actorId: string, action: string, targetId?: string | null, data: Prisma.InputJsonValue = {}, reason?: string) {
    return this.db.auditLog.create({ data: { eventId, actorId, action, targetId: targetId ?? null, data, reason: reason ?? null } });
  }

  track(eventId: string, type: string, userId: string | null, projectId: string | null = null, data: Prisma.InputJsonValue = {}) {
    return this.db.analyticsEvent.create({ data: { eventId, type, userId, projectId, data } });
  }
}
