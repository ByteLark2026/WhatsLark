import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('AI Bot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('settings')
  getSettings(@CurrentCompanyId() companyId: string) {
    return this.service.getSettings(companyId);
  }

  @Put('settings')
  updateSettings(@CurrentCompanyId() companyId: string, @Body() dto: any) {
    return this.service.updateSettings(companyId, dto);
  }

  @Post('suggest')
  suggest(@CurrentCompanyId() companyId: string, @Body('conversation_id') conversationId: string) {
    return this.service.suggestReply(companyId, conversationId);
  }

  @Get('knowledge')
  listKb(@CurrentCompanyId() companyId: string) {
    return this.service.listKnowledgeBase(companyId);
  }

  @Post('knowledge')
  addKb(@CurrentCompanyId() companyId: string, @Body() dto: any) {
    return this.service.addKnowledge(companyId, dto);
  }

  @Put('knowledge/:id')
  updateKb(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateKnowledge(companyId, id, dto);
  }

  @Delete('knowledge/:id')
  deleteKb(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.deleteKnowledge(companyId, id);
  }
}
