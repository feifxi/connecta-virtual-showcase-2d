import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({ imports: [PeopleModule], controllers: [ProjectsController, FilesController], providers: [ProjectsService, FilesService], exports: [ProjectsService] })
export class ProjectsModule {}
