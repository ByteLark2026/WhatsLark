import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { QuotationsService } from './quotations.service';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('quotations')
export class QuotationsController {
  constructor(
    private readonly service: QuotationsService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
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

  @Post(':id/send-whatsapp')
  @UseGuards(JwtAuthGuard)
  async sendWhatsApp(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.sendWhatsApp(companyId, req.user.id, id);
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
  @UseGuards(JwtAuthGuard, CompanyGuard, RolesGuard)
  @Roles('owner', 'admin', 'manager')
  async delete(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.delete(companyId, id);
  }
}
