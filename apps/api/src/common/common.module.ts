import { Global, Module } from '@nestjs/common';
import { AccessGuard, AccessService } from './auth/access.js';
import { TokenVerifier } from './auth/auth.guard.js';

@Global()
@Module({ providers: [AccessService, AccessGuard, TokenVerifier], exports: [AccessService, AccessGuard, TokenVerifier] })
export class CommonModule {}
