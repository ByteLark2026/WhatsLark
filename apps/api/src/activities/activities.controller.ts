import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { ActivitiesService } from './activities.service';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  list(@CurrentCompanyId() companyId: string, @Query() q: any) {
    return this.service.list(companyId, {
      contact_id: q.contact_id,
      lead_id: q.lead_id,
      type: q.type,
      incomplete_only: q.incomplete_only === 'true',
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 50,
    });
  }

  @Get('upcoming')
  upcoming(@CurrentCompanyId() companyId: string, @Query('days') days?: string) {
    return this.service.getUpcoming(companyId, days ? parseInt(days) : 7);
  }

  @Post()
  create(@CurrentCompanyId() companyId: string, @Request() req: any, @Body() dto: any) {
    return this.service.create(companyId, req.user.id, dto);
  }

  @Patch(':id')
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.update(companyId, id, dto);
  }

  @Patch(':id/complete')
  complete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.complete(companyId, id);
  }

  @Patch(':id/uncomplete')
  uncomplete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.uncomplete(companyId, id);
  }

  @Delete(':id')
  delete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.delete(companyId, id);
  }
}
