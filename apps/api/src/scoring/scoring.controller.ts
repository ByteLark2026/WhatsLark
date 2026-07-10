import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { ScoringService } from './scoring.service';

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(private readonly service: ScoringService) {}

  @Get('leads')
  getScoredLeads(@CurrentCompanyId() companyId: string, @Query() q: any) {
    return this.service.getScoredLeads(companyId, {
      grade: q.grade,
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 50,
    });
  }

  @Post('recalculate')
  recalculate(@CurrentCompanyId() companyId: string) {
    return this.service.recalculateAll(companyId);
  }

  @Get('rules')
  getRules(@CurrentCompanyId() companyId: string) {
    return this.service.getScoreRules(companyId);
  }

  @Post('rules')
  createRule(@CurrentCompanyId() companyId: string, @Body() dto: any) {
    return this.service.createRule(companyId, dto);
  }

  @Patch('rules/:id')
  updateRule(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateRule(companyId, id, dto);
  }

  @Delete('rules/:id')
  deleteRule(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.deleteRule(companyId, id);
  }
}
