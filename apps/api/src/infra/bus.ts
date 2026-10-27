import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { hallBoothKey, hallChannel, type HallSignal } from '@connecta/shared';
import { env } from '../env.js';

/** api → realtime: tell the hall room something changed after the DB write (roles, booths, kick, announcements) */
@Injectable()
export class HallBus implements OnModuleDestroy {
  private readonly log = new Logger(HallBus.name);
  private readonly redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });

  async publish(eventId: string, signal: HallSignal) {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.publish(hallChannel(eventId), JSON.stringify(signal));
    } catch (e) {
      // the DB is the source of truth · a missed signal only delays the hall until people rejoin
      this.log.warn(`hall signal ${signal.type} for ${eventId} not delivered: ${(e as Error).message}`);
    }
  }

  /** Which booth (projectId) someone stands in right now · written by realtime, '' when walking the hall */
  async boothOf(eventId: string, userId: string) {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return (await this.redis.hget(hallBoothKey(eventId), userId)) || null;
    } catch {
      return null;
    }
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
