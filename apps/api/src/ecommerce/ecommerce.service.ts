import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class EcommerceService {
  constructor(private readonly supabase: SupabaseService) {}

  private db() { return this.supabase.getAdminClient(); }

  // ── Connections ─────────────────────────────────────────────────────────────
  async listConnections(companyId: string) {
    const { data, error } = await this.db()
      .from('ecommerce_connections')
      .select('id, platform, store_name, store_url, is_active, last_sync_at, created_at')
      .eq('company_id', companyId)
      .order('created_at');
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createConnection(companyId: string, dto: {
    platform: 'woocommerce' | 'shopify';
    store_name: string;
    store_url: string;
    consumer_key?: string;
    consumer_secret?: string;
    api_access_token?: string;
  }) {
    const url = dto.store_url.replace(/\/$/, '');
    // Test connection before saving
    await this.testStoreConnection({ ...dto, store_url: url });

    const webhookSecret = crypto.randomUUID().replace(/-/g, '');
    const { data, error } = await this.db()
      .from('ecommerce_connections')
      .insert({ company_id: companyId, ...dto, store_url: url, webhook_secret: webhookSecret })
      .select('id, platform, store_name, store_url, is_active, webhook_secret')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateConnection(companyId: string, id: string, dto: Partial<{
    store_name: string; is_active: boolean;
    consumer_key: string; consumer_secret: string; api_access_token: string;
  }>) {
    const { data, error } = await this.db()
      .from('ecommerce_connections')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id, platform, store_name, store_url, is_active')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteConnection(companyId: string, id: string) {
    const { error } = await this.db()
      .from('ecommerce_connections')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ── Connection test ──────────────────────────────────────────────────────────
  async testStoreConnection(dto: { platform: string; store_url: string; consumer_key?: string; consumer_secret?: string; api_access_token?: string }) {
    try {
      if (dto.platform === 'woocommerce') {
        const url = `${dto.store_url}/wp-json/wc/v3/products?per_page=1&consumer_key=${dto.consumer_key}&consumer_secret=${dto.consumer_secret}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`WooCommerce API returned ${res.status}`);
      } else {
        const res = await fetch(`${dto.store_url}/admin/api/2024-01/shop.json`, {
          headers: { 'X-Shopify-Access-Token': dto.api_access_token || '' },
        });
        if (!res.ok) throw new Error(`Shopify API returned ${res.status}`);
      }
    } catch (err: any) {
      throw new BadRequestException(`Connection failed: ${err.message}`);
    }
  }

  // ── Product sync ─────────────────────────────────────────────────────────────
  async syncProducts(companyId: string, connectionId: string) {
    const { data: conn } = await this.db()
      .from('ecommerce_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('company_id', companyId)
      .single();
    if (!conn) throw new NotFoundException('Connection not found');

    const products = conn.platform === 'woocommerce'
      ? await this.fetchWooProducts(conn)
      : await this.fetchShopifyProducts(conn);

    if (!products.length) return { synced: 0 };

    // Upsert all products
    const rows = products.map((p: any) => ({
      connection_id: connectionId,
      company_id: companyId,
      external_id: String(p.external_id),
      name: p.name,
      description: p.description,
      price: p.price,
      compare_price: p.compare_price ?? null,
      currency: p.currency || 'AED',
      image_url: p.image_url ?? null,
      product_url: p.product_url ?? null,
      sku: p.sku ?? null,
      stock_status: p.stock_status ?? 'instock',
      is_active: true,
      raw_data: p.raw,
    }));

    const { error } = await this.db()
      .from('ecommerce_products')
      .upsert(rows, { onConflict: 'connection_id,external_id' });
    if (error) throw new BadRequestException(error.message);

    await this.db()
      .from('ecommerce_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    return { synced: rows.length };
  }

  private async fetchWooProducts(conn: any): Promise<any[]> {
    const products: any[] = [];
    let page = 1;
    while (true) {
      const url = `${conn.store_url}/wp-json/wc/v3/products?per_page=50&page=${page}&consumer_key=${conn.consumer_key}&consumer_secret=${conn.consumer_secret}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const items: any[] = await res.json();
      if (!items.length) break;
      products.push(...items.map((p) => ({
        external_id: p.id,
        name: p.name,
        description: p.short_description?.replace(/<[^>]+>/g, '') || p.description?.replace(/<[^>]+>/g, '') || '',
        price: parseFloat(p.price || p.regular_price || '0'),
        compare_price: p.regular_price && p.sale_price ? parseFloat(p.regular_price) : null,
        image_url: p.images?.[0]?.src || null,
        product_url: p.permalink,
        sku: p.sku || null,
        stock_status: p.stock_status || 'instock',
        raw: { id: p.id, name: p.name, status: p.status },
      })));
      if (items.length < 50) break;
      page++;
    }
    return products;
  }

  private async fetchShopifyProducts(conn: any): Promise<any[]> {
    const products: any[] = [];
    let pageInfo: string | null = null;
    while (true) {
      const url = pageInfo
        ? `${conn.store_url}/admin/api/2024-01/products.json?limit=50&page_info=${pageInfo}`
        : `${conn.store_url}/admin/api/2024-01/products.json?limit=50`;
      const res = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': conn.api_access_token },
      });
      if (!res.ok) break;
      const json = await res.json();
      const items: any[] = json.products || [];
      if (!items.length) break;
      products.push(...items.map((p) => {
        const variant = p.variants?.[0];
        return {
          external_id: p.id,
          name: p.title,
          description: p.body_html?.replace(/<[^>]+>/g, '') || '',
          price: parseFloat(variant?.price || '0'),
          compare_price: variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null,
          image_url: p.image?.src || p.images?.[0]?.src || null,
          product_url: `${conn.store_url}/products/${p.handle}`,
          sku: variant?.sku || null,
          stock_status: p.status === 'active' ? 'instock' : 'outofstock',
          raw: { id: p.id, title: p.title, status: p.status },
        };
      }));
      // Shopify pagination via Link header
      const link = res.headers.get('Link') || '';
      const nextMatch = link.match(/<[^>]+page_info=([^>&]+)[^>]*>;\s*rel="next"/);
      pageInfo = nextMatch ? nextMatch[1] : null;
      if (!pageInfo) break;
    }
    return products;
  }

  // ── Products list ─────────────────────────────────────────────────────────────
  async listProducts(companyId: string, opts: { connectionId?: string; search?: string; page?: number; limit?: number }) {
    const { connectionId, search, page = 1, limit = 30 } = opts;
    let q = this.db()
      .from('ecommerce_products')
      .select('id, connection_id, external_id, name, price, compare_price, image_url, product_url, sku, stock_status, ecommerce_connections(platform, store_name)', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')
      .range((page - 1) * limit, page * limit - 1);
    if (connectionId) q = q.eq('connection_id', connectionId);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  // ── Order events ──────────────────────────────────────────────────────────────
  async listOrderEvents(companyId: string, opts: { connectionId?: string; event_type?: string; page?: number; limit?: number }) {
    const { connectionId, event_type, page = 1, limit = 30 } = opts;
    let q = this.db()
      .from('ecommerce_order_events')
      .select('*, ecommerce_connections(platform, store_name)', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (connectionId) q = q.eq('connection_id', connectionId);
    if (event_type) q = q.eq('event_type', event_type);
    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  // ── Incoming webhook from store ───────────────────────────────────────────────
  async handleStoreWebhook(opts: {
    connectionId: string;
    platform: 'woocommerce' | 'shopify';
    eventType: string; // woo: order.created etc; shopify: orders/create etc
    payload: any;
    companyId: string;
    channelId?: string;
    accessToken?: string;
    phoneNumberId?: string;
  }) {
    const { connectionId, platform, eventType, payload, companyId } = opts;

    const mapped = platform === 'woocommerce'
      ? this.mapWooEvent(eventType, payload)
      : this.mapShopifyEvent(eventType, payload);

    if (!mapped) return { ignored: true };

    // Insert order event
    const { data: orderEvent, error } = await this.db()
      .from('ecommerce_order_events')
      .insert({
        connection_id: connectionId,
        company_id: companyId,
        event_type: mapped.event_type,
        external_order_id: String(mapped.order_id),
        order_number: String(mapped.order_number || mapped.order_id),
        customer_phone: mapped.phone,
        customer_name: mapped.name,
        customer_email: mapped.email,
        total_amount: mapped.total,
        currency: mapped.currency || 'AED',
        items: mapped.items || [],
        tracking_url: mapped.tracking_url || null,
        raw_data: payload,
      })
      .select('id')
      .single();

    if (error) throw new BadRequestException(error.message);

    // Fire WhatsApp notification if channel configured
    if (opts.accessToken && opts.phoneNumberId && mapped.phone) {
      await this.sendOrderWhatsApp({
        companyId: opts.companyId,
        accessToken: opts.accessToken,
        phoneNumberId: opts.phoneNumberId,
        channelId: opts.channelId,
        mapped,
        orderEventId: orderEvent.id,
      }).catch((err) => console.error('[ecommerce] WhatsApp send error:', err));
    }

    return { ok: true, event_type: mapped.event_type, order_id: mapped.order_id };
  }

  private normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    // Strip leading zero and prepend UAE country code if looks local
    if (digits.startsWith('0') && digits.length <= 10) digits = '971' + digits.slice(1);
    // Must be at least 10 digits to be valid
    return digits.length >= 10 ? digits : null;
  }

  private mapWooEvent(topic: string, p: any) {
    const billing = p.billing || {};
    const phone = this.normalizePhone(billing.phone);
    const base = {
      order_id: p.id,
      order_number: p.number ?? p.id,
      name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim(),
      phone,
      email: billing.email,
      total: parseFloat(p.total || '0'),
      currency: p.currency,
      items: (p.line_items || []).map((i: any) => ({ name: i.name, qty: i.quantity, price: i.total })),
      tracking_url: p.meta_data?.find((m: any) => m.key === '_tracking_url')?.value || null,
      payment_method: p.payment_method_title || p.payment_method || null,
    };
    if (topic.includes('created')) return { ...base, event_type: 'order_placed' as const };
    if (topic.includes('processing')) return { ...base, event_type: 'order_confirmed' as const };
    if (topic.includes('shipped') || topic.includes('completed')) return { ...base, event_type: 'order_shipped' as const };
    if (topic.includes('cancelled')) return { ...base, event_type: 'order_cancelled' as const };
    if (topic.includes('refunded')) return { ...base, event_type: 'order_refunded' as const };
    return null;
  }

  private mapShopifyEvent(topic: string, p: any) {
    const phone = this.normalizePhone(p.phone || p.billing_address?.phone || p.shipping_address?.phone);
    const base = {
      order_id: p.id,
      order_number: p.order_number,
      name: `${p.customer?.first_name || ''} ${p.customer?.last_name || ''}`.trim(),
      phone,
      email: p.email || p.customer?.email,
      total: parseFloat(p.total_price || '0'),
      currency: p.currency,
      items: (p.line_items || []).map((i: any) => ({ name: i.name, qty: i.quantity, price: i.price })),
      tracking_url: p.fulfillments?.[0]?.tracking_url || null,
    };
    if (topic === 'orders/create') return { ...base, event_type: 'order_placed' as const };
    if (topic === 'orders/updated') return { ...base, event_type: 'order_confirmed' as const };
    if (topic === 'orders/fulfilled') return { ...base, event_type: 'order_shipped' as const };
    if (topic === 'orders/cancelled') return { ...base, event_type: 'order_cancelled' as const };
    if (topic === 'refunds/create') return { ...base, event_type: 'order_refunded' as const };
    return null;
  }

  private async sendOrderWhatsApp(opts: {
    companyId: string;
    accessToken: string;
    phoneNumberId: string;
    channelId?: string;
    orderEventId: string;
    mapped: any;
  }) {
    const { companyId, accessToken, phoneNumberId, channelId, orderEventId, mapped } = opts;
    if (!mapped.phone) return;

    const GRAPH_V = process.env.WHATSAPP_API_VERSION || 'v21.0';
    const to = mapped.phone;

    // Build message based on event type
    const otp = null;
    const itemsSummary = (mapped.items || []).slice(0, 3).map((i: any) => `• ${i.name} x${i.qty}`).join('\n');

    const messages: Record<string, string> = {
      order_placed: `🛍️ Order #${mapped.order_number} confirmed!\n\nHello ${mapped.name || 'there'},\n\nItems:\n${itemsSummary}\n\nTotal: ${mapped.currency} ${mapped.total}\nPayment: ${mapped.payment_method || 'N/A'}\n\nThank you for shopping with us! 🙏`,
      order_confirmed: `✅ Order #${mapped.order_number} confirmed and being processed!\n\nHello ${mapped.name || 'there'}, we're preparing your order.\n\nTotal: ${mapped.currency} ${mapped.total}`,
      order_shipped: `🚚 Order #${mapped.order_number} shipped!\n\nHello ${mapped.name || 'there'}, your order is on the way!\n\n${mapped.tracking_url ? `Track: ${mapped.tracking_url}` : 'You will receive a tracking link shortly.'}`,
      order_delivered: `✅ Order #${mapped.order_number} delivered!\n\nHello ${mapped.name || 'there'}, your order has been delivered.\n\nWe hope you enjoy it! Feel free to reach out if you need anything.`,
      order_cancelled: `❌ Order #${mapped.order_number} cancelled.\n\nHello ${mapped.name || 'there'}, your order has been cancelled.\n\nIf you have questions, please reply to this message.`,
      order_refunded: `💰 Refund initiated for Order #${mapped.order_number}.\n\nHello ${mapped.name || 'there'}, your refund is being processed.\n\nTotal: ${mapped.currency} ${mapped.total}`,
    };

    const body = messages[mapped.event_type as keyof typeof messages];
    if (!body) return;

    const res = await fetch(`https://graph.facebook.com/${GRAPH_V}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    });
    const json = await res.json();
    const waId = json.messages?.[0]?.id;

    if (!res.ok || !waId) {
      console.error(`[ecommerce] Meta API error for ${to}: status=${res.status} body=${JSON.stringify(json)}`);
      return;
    }

    // Update order event as sent
    await this.db()
      .from('ecommerce_order_events')
      .update({ whatsapp_sent: true, whatsapp_sent_at: new Date().toISOString(), otp_code: otp })
      .eq('id', orderEventId);

    // Upsert contact + store message in DB if channelId provided
    if (channelId && waId) {
      const { data: contact } = await this.db()
        .from('contacts')
        .upsert({ company_id: companyId, phone: to, name: mapped.name || to, last_seen_at: new Date().toISOString() }, { onConflict: 'company_id,phone' })
        .select('id').single();

      if (contact) {
        let { data: convs } = await this.db()
          .from('conversations').select('id').eq('contact_id', contact.id).eq('channel_id', channelId).neq('status', 'closed').limit(1);
        let convId = convs?.[0]?.id;
        if (!convId) {
          const { data: created } = await this.db()
            .from('conversations').insert({ company_id: companyId, contact_id: contact.id, channel_id: channelId, status: 'open', unread_count: 0 })
            .select('id').single();
          convId = created?.id;
        }
        if (convId) {
          await this.db().from('messages').insert({
            conversation_id: convId, company_id: companyId, channel_id: channelId,
            direction: 'outbound', type: 'text', content: body, status: 'sent', wa_message_id: waId, is_note: false,
          });
        }
      }
    }

    console.log(`[ecommerce] WhatsApp sent for ${mapped.event_type} order #${mapped.order_number}, wa_id:`, waId);
  }

  // ── Get channel for company ───────────────────────────────────────────────────
  async getDefaultChannel(companyId: string) {
    const { data } = await this.db()
      .from('whatsapp_channels')
      .select('id, access_token, phone_number_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .limit(1)
      .single();
    return data;
  }
}
