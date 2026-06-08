import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('company')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get()     get(@CurrentCompanyId() c: string) { return this.service.get(c); }
  @Put()     update(@CurrentCompanyId() c: string, @Body() dto: any) { return this.service.update(c, dto); }
  @Get('tags') tags(@CurrentCompanyId() c: string) { return this.service.getTags(c); }
  @Post('tags') createTag(@CurrentCompanyId() c: string, @Body() dto: any) { return this.service.createTag(c, dto); }
  @Delete('tags/:id') deleteTag(@CurrentCompanyId() c: string, @Param('id') id: string) { return this.service.deleteTag(c, id); }
}
