import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Post('send')
  send(
    @CurrentCompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { conversation_id: string; message: string },
  ) {
    return this.service.sendMessage(companyId, userId, body);
  }

  @Get('quick-replies')
  quickReplies(@CurrentCompanyId() companyId: string) {
    return this.service.getQuickReplies(companyId);
  }

  @Post('quick-replies')
  createQuickReply(
    @CurrentCompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { shortcut: string; message: string },
  ) {
    return this.service.createQuickReply(companyId, userId, body);
  }

  @Delete('quick-replies/:id')
  deleteQuickReply(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.deleteQuickReply(companyId, id);
  }
}
