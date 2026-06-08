import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  list(
    @CurrentCompanyId() companyId: string,
    @Query('status') status?: string,
    @Query('assigned_to') assigned_to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.list(companyId, { status, assigned_to, page, limit });
  }

  @Get(':id')
  get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.get(companyId, id);
  }

  @Get(':id/messages')
  getMessages(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getMessages(companyId, id, page, limit);
  }

  @Patch(':id/assign')
  assign(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body('agent_id') agentId: string | null,
  ) {
    return this.service.assign(companyId, id, agentId);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.service.updateStatus(companyId, id, status);
  }

  @Post(':id/notes')
  addNote(
    @CurrentCompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.service.addNote(companyId, id, userId, content);
  }

  @Get(':id/tags')
  getTags(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.getTags(companyId, id);
  }

  @Post(':id/tags')
  addTag(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body('tag_id') tagId: string,
  ) {
    return this.service.addTag(companyId, id, tagId);
  }
}
