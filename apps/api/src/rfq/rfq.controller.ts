import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { RfqService } from './rfq.service';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('rfq')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class RfqController {
  constructor(
    private readonly service: RfqService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
  }

  @Get()
  async list(@Request() req: any, @Query() q: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.list(companyId, { status: q.status, page: q.page ? +q.page : 1, limit: q.limit ? +q.limit : 50 });
  }

  @Get(':id')
  async get(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.get(companyId, id);
  }

  @Patch(':id/items/:itemId')
  async updateItem(@Request() req: any, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.updateItem(companyId, id, itemId, dto);
  }

  @Post(':id/quote')
  async generateQuote(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.generateQuote(companyId, req.user.id, id);
  }
}
