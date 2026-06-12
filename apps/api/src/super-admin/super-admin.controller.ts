import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Get('stats') stats() { return this.service.getPlatformStats(); }
  @Get('companies') companies(@Query() q: any) { return this.service.listCompanies(q); }
  @Get('companies/:id') company(@Param('id') id: string) { return this.service.getCompany(id); }
  @Patch('companies/:id/status') status(@Param('id') id: string, @Body('status') status: string) { return this.service.setCompanyStatus(id, status); }
  @Get('companies/:id/usage') usage(@Param('id') id: string) { return this.service.getUsage(id); }
  @Get('users') users(@Query() q: any) { return this.service.listUsers(q); }

  @Get('channels') channels(@Query() q: any) { return this.service.listChannels(q); }
  @Get('campaigns') allCampaigns(@Query() q: any) { return this.service.listAllCampaigns(q); }
  @Get('templates') allTemplates(@Query() q: any) { return this.service.listAllTemplates(q); }
  @Get('contacts') allContacts(@Query() q: any) { return this.service.listAllContacts(q); }
  @Get('message-logs') messageLogs(@Query() q: any) { return this.service.listMessageLogs(q); }
  @Get('analytics') analytics(@Query() q: any) { return this.service.getPlatformAnalytics(q); }
}
