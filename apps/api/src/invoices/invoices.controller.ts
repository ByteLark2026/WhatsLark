import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  // Public — no auth
  @Get('public/:token')
  getPublic(@Param('token') token: string) {
    return this.service.getByToken(token);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  stats(@CurrentCompanyId() companyId: string) {
    return this.service.getStats(companyId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentCompanyId() companyId: string, @Query() q: any) {
    return this.service.list(companyId, { status: q.status, page: q.page ? +q.page : 1, limit: q.limit ? +q.limit : 50 });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentCompanyId() companyId: string, @Request() req: any, @Body() dto: any) {
    return this.service.create(companyId, req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.get(companyId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.update(companyId, id, dto);
  }

  @Patch(':id/send')
  @UseGuards(JwtAuthGuard)
  send(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.send(companyId, id);
  }

  @Patch(':id/paid')
  @UseGuards(JwtAuthGuard)
  markPaid(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.markPaid(companyId, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.delete(companyId, id);
  }
}
