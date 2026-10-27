import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module.js';
import { LifecycleService } from './lifecycle.service.js';

@Module({ imports: [PeopleModule], providers: [LifecycleService], exports: [LifecycleService] })
export class LifecycleModule {}
