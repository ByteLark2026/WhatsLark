import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  // Projects
  @Get()
  listProjects(@CurrentCompanyId() companyId: string, @Query() q: any) {
    return this.service.listProjects(companyId, { status: q.status });
  }

  @Post()
  createProject(@CurrentCompanyId() companyId: string, @Request() req: any, @Body() dto: any) {
    return this.service.createProject(companyId, req.user.id, dto);
  }

  @Get(':id')
  getProject(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.getProject(companyId, id);
  }

  @Patch(':id')
  updateProject(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateProject(companyId, id, dto);
  }

  @Delete(':id')
  deleteProject(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.deleteProject(companyId, id);
  }

  // Tasks
  @Get(':id/tasks')
  tasksBoard(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.getTasksBoard(companyId, id);
  }

  @Post(':id/tasks')
  createTask(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: any,
  ) {
    return this.service.createTask(companyId, id, req.user.id, dto);
  }

  @Patch(':id/tasks/:taskId')
  updateTask(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: any,
  ) {
    return this.service.updateTask(companyId, id, taskId, dto);
  }

  @Delete(':id/tasks/:taskId')
  deleteTask(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.service.deleteTask(companyId, id, taskId);
  }
}
