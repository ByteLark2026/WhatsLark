import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()   list(@CurrentCompanyId() c: string) { return this.service.list(c); }
  @Get(':id') get(@CurrentCompanyId() c: string, @Param('id') id: string) { return this.service.get(c, id); }
  @Post()  create(@CurrentCompanyId() c: string, @Body() dto: any) { return this.service.create(c, dto); }
  @Put(':id') update(@CurrentCompanyId() c: string, @Param('id') id: string, @Body() dto: any) { return this.service.update(c, id, dto); }
  @Delete(':id') delete(@CurrentCompanyId() c: string, @Param('id') id: string) { return this.service.delete(c, id); }
}
