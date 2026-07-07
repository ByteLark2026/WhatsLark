import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  async list(@CurrentUser('id') userId: string, @Query() q: any) {
    const companyId = await this.service.getCompanyId(userId);
    return this.service.list(companyId, q);
  }

  @Get(':id')
  async get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const companyId = await this.service.getCompanyId(userId);
    return this.service.get(companyId, id);
  }

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: any) {
    const companyId = await this.service.getCompanyId(userId);
    return this.service.create(companyId, userId, dto);
  }

  @Post(':id/launch')
  async launch(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const companyId = await this.service.getCompanyId(userId);
    return this.service.launch(companyId, id);
  }

  @Patch(':id/pause')
  async pause(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const companyId = await this.service.getCompanyId(userId);
    return this.service.pause(companyId, id);
  }

  @Get(':id/recipients')
  async recipients(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const companyId = await this.service.getCompanyId(userId);
    return this.service.getRecipients(companyId, id);
  }

  @Get(':id/stats')
  async stats(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const companyId = await this.service.getCompanyId(userId);
    return this.service.getStats(companyId, id);
  }
}
