import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  list(@CurrentCompanyId() companyId: string, @Query() q: any) {
    return this.service.list(companyId, q);
  }

  @Get('board')
  board(@CurrentCompanyId() companyId: string) {
    return this.service.getByStage(companyId);
  }

  @Get(':id')
  get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.get(companyId, id);
  }

  @Post()
  create(@CurrentCompanyId() companyId: string, @Body() dto: any) {
    return this.service.create(companyId, dto);
  }

  @Put(':id')
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.update(companyId, id, dto);
  }

  @Patch(':id/stage')
  moveStage(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body('stage') stage: string) {
    return this.service.moveStage(companyId, id, stage);
  }

  @Delete(':id')
  delete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.delete(companyId, id);
  }
}
