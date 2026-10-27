import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';

@Module({ imports: [PeopleModule], controllers: [MeController], providers: [MeService] })
export class MeModule {}
