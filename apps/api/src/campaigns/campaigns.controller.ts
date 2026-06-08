import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  list(@CurrentCompanyId() companyId: string, @Query() q: any) {
    return this.service.list(companyId, q);
  }

  @Get(':id')
  get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.get(companyId, id);
  }

  @Post()
  create(
    @CurrentCompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    return this.service.create(companyId, userId, dto);
  }

  @Post(':id/launch')
  launch(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.launch(companyId, id);
  }

  @Patch(':id/pause')
  pause(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.pause(companyId, id);
  }

  @Get(':id/recipients')
  recipients(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.getRecipients(companyId, id);
  }

  @Get(':id/stats')
  stats(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.getStats(companyId, id);
  }
}
