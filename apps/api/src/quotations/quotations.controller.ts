import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QuotationsService } from './quotations.service';
import { SupabaseService } from '../common/supabase.service';

@Controller('quotations')
export class QuotationsController {
  constructor(
    private readonly service: QuotationsService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    const { data } = await this.supabase.getAdminClient()
      .from('company_users').select('company_id').eq('user_id', userId).eq('is_active', true).limit(1).single();
    return data?.company_id;
  }

  // Public — no auth (MUST be before :id)
  @Get('public/:token')
  getPublic(@Param('token') token: string) {
    return this.service.getByToken(token);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async stats(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.getStats(companyId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Request() req: any, @Query() q: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.list(companyId, { status: q.status, page: q.page ? +q.page : 1, limit: q.limit ? +q.limit : 50 });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.create(companyId, req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async get(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.get(companyId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.update(companyId, id, dto);
  }

  @Patch(':id/send')
  @UseGuards(JwtAuthGuard)
  async send(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.send(companyId, id);
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard)
  async accept(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.accept(companyId, id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  async reject(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.reject(companyId, id);
  }

  @Post(':id/convert')
  @UseGuards(JwtAuthGuard)
  async convert(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.convertToInvoice(companyId, req.user.id, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.delete(companyId, id);
  }
}
