import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, prismaOptions } from '@connecta/db';
import { env } from '../env.js';

/** Inject `Db` to use Prisma · one pool per process */
@Injectable()
export class Db extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super(prismaOptions(env.DATABASE_URL, 10));
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
