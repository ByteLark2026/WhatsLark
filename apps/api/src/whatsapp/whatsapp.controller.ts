import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('WhatsApp Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyGuard, RolesGuard)
@Controller('channels')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  getChannels(@CurrentUser('id') userId: string) {
    return this.whatsapp.getChannels(userId);
  }

  @Roles('owner', 'admin')
  @Post()
  addChannel(@CurrentUser('id') userId: string, @Body() dto: any) {
    return this.whatsapp.addChannel(userId, dto);
  }

  @Roles('owner', 'admin')
  @Patch(':id')
  updateChannel(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.whatsapp.updateChannel(userId, id, dto);
  }

  @Roles('owner', 'admin')
  @Patch(':id/toggle')
  toggleActive(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.whatsapp.toggleActive(userId, id);
  }

  @Roles('owner', 'admin')
  @Delete(':id')
  deleteChannel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.whatsapp.deleteChannel(userId, id);
  }

  @Post(':id/send')
  sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') channelId: string,
    @Body() body: { to: string; message: string },
  ) {
    return this.whatsapp.sendTextMessageAsUser(userId, channelId, body.to, body.message);
  }
}
