import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../../common/guards/company.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationConnectionsService } from './integration-connections.service';
import { SupabaseService } from '../../common/supabase.service';
import { resolveCompanyId } from '../../common/company-cache.util';

@Controller('integrations/erp')
@UseGuards(JwtAuthGuard, CompanyGuard, RolesGuard)
export class IntegrationConnectionsController {
  constructor(
    private readonly service: IntegrationConnectionsService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
  }

  @Get()
  @Roles('owner', 'admin', 'manager')
  async list(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.list(companyId);
  }

  @Post()
  @Roles('owner', 'admin')
  async upsert(@Request() req: any, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.upsert(companyId, dto);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  async deactivate(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.deactivate(companyId, id);
  }
}
