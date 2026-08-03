import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VoiceChannelsService } from './voice-channels.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Voice Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyGuard, RolesGuard)
@Controller('voice/channels')
export class VoiceChannelsController {
  constructor(private readonly service: VoiceChannelsService) {}

  @Get()
  getChannels(@CurrentCompanyId() companyId: string) {
    return this.service.getChannels(companyId);
  }

  @Roles('owner', 'admin')
  @Post()
  addChannel(@CurrentCompanyId() companyId: string, @Body() dto: any) {
    return this.service.addChannel(companyId, dto);
  }

  @Roles('owner', 'admin')
  @Patch(':id')
  updateChannel(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateChannel(companyId, id, dto);
  }

  @Roles('owner', 'admin')
  @Delete(':id')
  deleteChannel(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.deleteChannel(companyId, id);
  }
}
