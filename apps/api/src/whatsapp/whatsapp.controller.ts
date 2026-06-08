import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('WhatsApp Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  getChannels(@CurrentCompanyId() companyId: string) {
    return this.whatsapp.getChannels(companyId);
  }

  @Post()
  addChannel(@CurrentCompanyId() companyId: string, @Body() dto: any) {
    return this.whatsapp.addChannel(companyId, dto);
  }

  @Delete(':id')
  deleteChannel(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.whatsapp.deleteChannel(companyId, id);
  }

  @Post(':id/send')
  sendMessage(
    @Param('id') channelId: string,
    @Body() body: { to: string; message: string },
  ) {
    return this.whatsapp.sendTextMessage(channelId, body.to, body.message);
  }
}
