import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { WidgetService } from './widget.service';

@ApiTags('Website Widget')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('widget')
export class WidgetController {
  constructor(private readonly service: WidgetService) {}

  @Post('start')
  start(@Body() body: { siteId: string; conversationId?: string; visitorToken?: string }) {
    const resume = body.conversationId && body.visitorToken
      ? { conversationId: body.conversationId, visitorToken: body.visitorToken }
      : undefined;
    return this.service.start(body.siteId, resume);
  }

  @Post('messages')
  send(@Body() body: { siteId: string; conversationId: string; visitorToken: string; content: string }) {
    return this.service.sendMessage(body.siteId, body.conversationId, body.visitorToken, body.content);
  }

  @Get('messages')
  list(@Query() query: { siteId: string; conversationId: string; visitorToken: string; after?: string }) {
    return this.service.getMessages(query.siteId, query.conversationId, query.visitorToken, query.after);
  }
}
