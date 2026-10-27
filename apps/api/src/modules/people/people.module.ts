import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service.js';
import { MembersService } from './members.service.js';
import { PeopleController } from './people.controller.js';

@Module({ controllers: [PeopleController], providers: [MembersService, InvitesService], exports: [InvitesService] })
export class PeopleModule {}
