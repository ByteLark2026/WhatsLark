import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { CreateLeadDto, UpdateLeadDto } from './dto/create-lead.dto';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyGuard)
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

  @Get('forecast')
  forecast(@CurrentCompanyId() companyId: string) {
    return this.service.getForecast(companyId);
  }

  @Get(':id')
  get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.get(companyId, id);
  }

  @Post()
  create(@CurrentCompanyId() companyId: string, @Body() dto: CreateLeadDto) {
    return this.service.create(companyId, dto);
  }

  @Put(':id')
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.service.update(companyId, id, dto);
  }

  @Patch(':id/stage')
  moveStage(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body('stage') stage: string) {
    const VALID_STAGES = ['new_lead', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost'];
    if (!VALID_STAGES.includes(stage)) {
      throw new BadRequestException(`Invalid stage "${stage}" — must be one of: ${VALID_STAGES.join(', ')}`);
    }
    return this.service.moveStage(companyId, id, stage);
  }

  @Delete(':id')
  delete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.delete(companyId, id);
  }
}
