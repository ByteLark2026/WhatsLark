import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupportTicketsService } from './support-tickets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Support Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly service: SupportTicketsService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query() q: any) {
    return this.service.list(userId, q);
  }

  @Get(':id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.get(userId, id);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: { subject: string; description: string; priority?: string }) {
    return this.service.create(userId, dto);
  }

  @Post(':id/replies')
  addReply(@CurrentUser('id') userId: string, @Param('id') id: string, @Body('message') message: string) {
    return this.service.addReply(userId, id, message);
  }
}
