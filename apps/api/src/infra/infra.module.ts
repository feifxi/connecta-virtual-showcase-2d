import { Global, Module } from '@nestjs/common';
import { Audit } from './audit.js';
import { HallBus } from './bus.js';
import { Db } from './db.js';
import { Mail } from './mail.js';
import { Media } from './media.js';
import { Storage } from './storage.js';

@Global()
@Module({ providers: [Db, HallBus, Storage, Mail, Media, Audit], exports: [Db, HallBus, Storage, Mail, Media, Audit] })
export class InfraModule {}
