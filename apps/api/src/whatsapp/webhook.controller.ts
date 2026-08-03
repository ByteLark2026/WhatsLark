import { Controller, Get, Post, Query, Body, HttpCode, Res, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppWebhookService } from './webhook.service';

@ApiTags('WhatsApp Webhook')
@Controller('webhook/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly webhookService: WhatsAppWebhookService) {}

  /** GET — Meta webhook verification handshake */
  @Public()
  @Get()
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe') {
      const verified = await this.webhookService.verifyToken(token);
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
  async handleIncoming(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const valid = await this.webhookService.verifySignature(body, (req as any).rawBody, signature);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    // Always respond 200 quickly — process async
    this.webhookService.processWebhook(body).catch(console.error);
    return res.status(200).send('EVENT_RECEIVED');
  }
}
