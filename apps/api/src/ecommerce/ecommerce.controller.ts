import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request, Headers, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EcommerceService } from './ecommerce.service';
import { SupabaseService } from '../common/supabase.service';

@Controller('ecommerce')
export class EcommerceController {
  private readonly logger = new Logger(EcommerceController.name);

  constructor(
    private readonly service: EcommerceService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    const { data } = await this.supabase.getAdminClient()
      .from('company_users').select('company_id').eq('user_id', userId).eq('is_active', true).limit(1).single();
    return data?.company_id;
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
  async woocommerceWebhook(
    @Param('connectionId') connectionId: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Body() payload: any,
  ) {
    this.logger.log(`[WC webhook] connectionId=${connectionId} topic=${topic} keys=${Object.keys(payload || {}).join(',')}`);
    const conn = await this.getConnectionWithSecret(connectionId);
    if (!conn) { this.logger.warn(`[WC webhook] connection not found: ${connectionId}`); return { ignored: true }; }
    // connectionId UUID acts as the secret — no additional header check needed
    const channel = await this.service.getDefaultChannel(conn.company_id);
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
  async shopifyWebhook(
    @Param('connectionId') connectionId: string,
    @Headers('x-shopify-topic') topic: string,
    @Body() payload: any,
  ) {
    const conn = await this.getConnectionWithSecret(connectionId);
    if (!conn) return { ignored: true };
    const channel = await this.service.getDefaultChannel(conn.company_id);
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

  private async getConnectionWithSecret(connectionId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('ecommerce_connections')
      .select('id, company_id, platform, webhook_secret, is_active')
      .eq('id', connectionId)
      .eq('is_active', true)
      .maybeSingle();
    return data;
  }
}
