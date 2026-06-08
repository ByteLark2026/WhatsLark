import { Controller, Get, Post, Query, Body, HttpCode, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppWebhookService } from './webhook.service';

@ApiTags('WhatsApp Webhook')
@Controller('webhook/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly webhookService: WhatsAppWebhookService) {}

  /** GET — Meta webhook verification handshake */
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe') {
      const verified = this.webhookService.verifyToken(token);
      if (verified) {
        return res.status(200).send(challenge);
      }
    }
    return res.status(403).json({ error: 'Invalid verify token' });
  }

  /** POST — Incoming messages and status updates */
  @Public()
  @Post()
  @HttpCode(200)
  async handleIncoming(@Body() body: any) {
    // Always respond 200 quickly — process async
    this.webhookService.processWebhook(body).catch(console.error);
    return 'EVENT_RECEIVED';
  }
}
