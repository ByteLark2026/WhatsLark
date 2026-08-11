import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request, Req, Headers, Logger, UsePipes, ValidationPipe, UnauthorizedException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EcommerceService } from './ecommerce.service';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('ecommerce')
export class EcommerceController {
  private readonly logger = new Logger(EcommerceController.name);

  constructor(
    private readonly service: EcommerceService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
  }

  // ── Connections ──────────────────────────────────────────────────────────────
  @Get('connections')
  @UseGuards(JwtAuthGuard)
  async listConnections(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.listConnections(companyId);
  }

  @Post('connections')
  @UseGuards(JwtAuthGuard)
  async createConnection(@Request() req: any, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.createConnection(companyId, dto);
  }

  @Post('connections/test')
  @UseGuards(JwtAuthGuard)
  async testConnection(@Body() dto: any) {
    await this.service.testStoreConnection(dto);
    return { ok: true, message: 'Connection successful' };
  }

  @Patch('connections/:id')
  @UseGuards(JwtAuthGuard)
  async updateConnection(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.updateConnection(companyId, id, dto);
  }

  @Delete('connections/:id')
  @UseGuards(JwtAuthGuard)
  async deleteConnection(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.deleteConnection(companyId, id);
  }

  // ── Product sync ─────────────────────────────────────────────────────────────
  @Post('connections/:id/sync')
  @UseGuards(JwtAuthGuard)
  async syncProducts(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.syncProducts(companyId, id);
  }

  // ── Products ──────────────────────────────────────────────────────────────────
  @Get('products')
  @UseGuards(JwtAuthGuard)
  async listProducts(@Request() req: any, @Query() q: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.listProducts(companyId, {
      connectionId: q.connection_id,
      search: q.search,
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 30,
    });
  }

  // ── Order events ──────────────────────────────────────────────────────────────
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async listOrders(@Request() req: any, @Query() q: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.listOrderEvents(companyId, {
      connectionId: q.connection_id,
      event_type: q.event_type,
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 30,
    });
  }

  // ── Webhooks from stores (no auth — verified by secret) ───────────────────────
  @Post('webhook/:connectionId/woocommerce')
  @UsePipes(new ValidationPipe({ transform: false, whitelist: false, forbidNonWhitelisted: false }))
  async woocommerceWebhook(
    @Param('connectionId') connectionId: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-signature') signature: string,
    @Body() payload: any,
    @Req() req: ExpressRequest,
  ) {
    this.logger.log(`[WC webhook] connectionId=${connectionId} topic=${topic} keys=${Object.keys(payload || {}).join(',')}`);
    const conn = await this.getConnectionWithSecret(connectionId);
    if (!conn) { this.logger.warn(`[WC webhook] connection not found: ${connectionId}`); return { ignored: true }; }
    this.verifyStoreSignature(conn, signature, (req as any).rawBody, 'base64');
    const channel = await this.service.getChannelForConnection(conn.company_id, conn.whatsapp_channel_id);
    this.logger.log(`[WC webhook] channel=${channel?.id} phone=${payload?.billing?.phone}`);
    return this.service.handleStoreWebhook({
      connectionId,
      platform: 'woocommerce',
      eventType: topic || 'order.created',
      payload,
      companyId: conn.company_id,
      channelId: channel?.id,
      accessToken: channel?.access_token,
      phoneNumberId: channel?.phone_number_id,
    });
  }

  @Post('webhook/:connectionId/shopify')
  @UsePipes(new ValidationPipe({ transform: false, whitelist: false, forbidNonWhitelisted: false }))
  async shopifyWebhook(
    @Param('connectionId') connectionId: string,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-hmac-sha256') signature: string,
    @Body() payload: any,
    @Req() req: ExpressRequest,
  ) {
    const conn = await this.getConnectionWithSecret(connectionId);
    if (!conn) return { ignored: true };
    this.verifyStoreSignature(conn, signature, (req as any).rawBody, 'base64');
    const channel = await this.service.getChannelForConnection(conn.company_id, conn.whatsapp_channel_id);
    return this.service.handleStoreWebhook({
      connectionId,
      platform: 'shopify',
      eventType: topic || 'orders/create',
      payload,
      companyId: conn.company_id,
      channelId: channel?.id,
      accessToken: channel?.access_token,
      phoneNumberId: channel?.phone_number_id,
    });
  }

  /** Verifies the store's HMAC signature against the connection's stored webhook_secret. */
  private verifyStoreSignature(conn: { webhook_secret?: string }, signatureHeader: string | undefined, rawBody: Buffer | undefined, encoding: 'base64' | 'hex') {
    if (!conn.webhook_secret) {
      this.logger.warn('Store webhook signature not verified: no webhook_secret configured for this connection');
      return;
    }
    if (!signatureHeader || !rawBody) throw new UnauthorizedException('Missing webhook signature');

    const expected = createHmac('sha256', conn.webhook_secret).update(rawBody).digest(encoding);
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private async getConnectionWithSecret(connectionId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('ecommerce_connections')
      .select('id, company_id, platform, webhook_secret, is_active, whatsapp_channel_id')
      .eq('id', connectionId)
      .eq('is_active', true)
      .maybeSingle();
    return data;
  }
}
