import { Global, Module } from '@nestjs/common';
import { AccessGuard, AccessService } from './auth/access.js';

@Global()
@Module({ providers: [AccessService, AccessGuard], exports: [AccessService, AccessGuard] })
export class CommonModule {}
