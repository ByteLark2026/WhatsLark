import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AutomationsService } from './automations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('automations')
export class AutomationsController {
  constructor(private readonly service: AutomationsService) {}

  @Get()   list(@CurrentCompanyId() c: string) { return this.service.list(c); }
  @Post()  create(@CurrentCompanyId() c: string, @Body() dto: any) { return this.service.create(c, dto); }
  @Put(':id') update(@CurrentCompanyId() c: string, @Param('id') id: string, @Body() dto: any) { return this.service.update(c, id, dto); }
  @Patch(':id/toggle') toggle(@CurrentCompanyId() c: string, @Param('id') id: string, @Body('is_active') active: boolean) { return this.service.toggle(c, id, active); }
  @Delete(':id') delete(@CurrentCompanyId() c: string, @Param('id') id: string) { return this.service.delete(c, id); }
}
