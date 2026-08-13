import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

/**
 * Direct-`.from()` data access, matching every other service in this codebase
 * (no repository/DAO layer exists elsewhere — see whatsapp.service.ts,
 * campaigns.service.ts, etc.). Kept as a separate class only to isolate the
 * billing tables' queries from orchestration logic in BillingService.
 */
@Injectable()
export class BillingRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private db() {
    return this.supabase.getAdminClient();
  }

  async listActivePlans() {
    const { data, error } = await this.db()
      .from('billing_plans')
      .select('id, code, name, description, features, display_order')
      .eq('active', true)
      .order('display_order');
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listActivePricesForPlans(planIds: string[]) {
    const { data, error } = await this.db()
      .from('billing_prices')
      .select('id, plan_id, provider, billing_interval, currency, amount_minor')
      .in('plan_id', planIds)
      .eq('active', true);
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** Trusted price lookup — the only place a frontend-supplied price id becomes a Razorpay plan_id. */
  async getActivePriceById(billingPriceId: string) {
    const { data, error } = await this.db()
      .from('billing_prices')
      .select('*, billing_plans!inner(id, code, name, features, active)')
      .eq('id', billingPriceId)
      .eq('active', true)
      .single();
    if (error || !data) throw new BadRequestException('Billing price not found or inactive');
    if (!data.billing_plans.active) throw new BadRequestException('Plan is not active');
    return data;
  }

  async getPriceByProviderPlanId(providerPlanId: string, provider = 'razorpay') {
    const { data } = await this.db()
      .from('billing_prices')
      .select('*, billing_plans(id, code, name, features)')
      .eq('provider', provider)
      .eq('provider_plan_id', providerPlanId)
      .maybeSingle();
    return data;
  }

  async getActiveSubscriptionForCompany(companyId: string) {
    const { data } = await this.db()
      .from('billing_subscriptions')
      .select('*, billing_prices(*, billing_plans(*))')
      .eq('company_id', companyId)
      .in('status', ['pending', 'authenticated', 'active', 'pending_payment', 'halted', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  async getSubscriptionById(id: string) {
    const { data } = await this.db()
      .from('billing_subscriptions')
      .select('*, billing_prices(*, billing_plans(*))')
      .eq('id', id)
      .maybeSingle();
    return data;
  }

  async getSubscriptionByProviderId(providerSubscriptionId: string, provider = 'razorpay') {
    const { data } = await this.db()
      .from('billing_subscriptions')
      .select('*, billing_prices(*, billing_plans(*))')
      .eq('provider', provider)
      .eq('provider_subscription_id', providerSubscriptionId)
      .maybeSingle();
    return data;
  }

  async createPendingSubscription(row: {
    company_id: string;
    billing_price_id: string;
    provider: string;
    created_by_user_id: string;
  }) {
    const { data, error } = await this.db()
      .from('billing_subscriptions')
      .insert({ ...row, status: 'pending' })
      .select()
      .single();
    if (error) throw new BadRequestException(`Could not create subscription: ${error.message}`);
    return data;
  }

  async attachProviderSubscriptionId(id: string, providerSubscriptionId: string) {
    const { data, error } = await this.db()
      .from('billing_subscriptions')
      .update({ provider_subscription_id: providerSubscriptionId })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateSubscription(id: string, patch: Record<string, any>) {
    const { data, error } = await this.db()
      .from('billing_subscriptions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listPaymentsForCompany(companyId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const { data, error, count } = await this.db()
      .from('billing_payments')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async upsertPaymentByProviderId(row: {
    provider_payment_id: string;
    company_id: string;
    billing_subscription_id: string;
    provider_invoice_id?: string | null;
    amount_minor: number;
    currency: string;
    status: string;
    payment_method?: string | null;
    paid_at?: string | null;
  }) {
    const { data, error } = await this.db()
      .from('billing_payments')
      .upsert(row, { onConflict: 'provider_payment_id' })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ---- Webhook idempotency ----

  /** Returns true if this event was newly recorded (i.e. not a duplicate). */
  async recordWebhookEventIfNew(row: {
    provider: string;
    provider_event_id: string;
    event_type: string;
    provider_created_at: string | null;
  }): Promise<boolean> {
    const { error } = await this.db()
      .from('billing_webhook_events')
      .insert({ ...row, processing_status: 'received' });
    // Unique violation (23505) on (provider, provider_event_id) means we've seen it before.
    if (error) {
      if (error.code === '23505') return false;
      throw new BadRequestException(error.message);
    }
    return true;
  }

  async markWebhookEventProcessed(providerEventId: string, provider = 'razorpay') {
    await this.db()
      .from('billing_webhook_events')
      .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('provider_event_id', providerEventId);
  }

  async markWebhookEventFailed(providerEventId: string, errorMessage: string, provider = 'razorpay') {
    await this.db()
      .from('billing_webhook_events')
      .update({ processing_status: 'failed', error_message: errorMessage.slice(0, 500) })
      .eq('provider', provider)
      .eq('provider_event_id', providerEventId);
  }

  // ---- Usage counters ----

  async getUsageCounter(companyId: string, metricCode: string, periodStart: string) {
    const { data } = await this.db()
      .from('company_usage_counters')
      .select('*')
      .eq('company_id', companyId)
      .eq('metric_code', metricCode)
      .eq('period_start', periodStart)
      .maybeSingle();
    return data;
  }

  async incrementUsageCounter(companyId: string, metricCode: string, periodStart: string, periodEnd: string, by: number) {
    const existing = await this.getUsageCounter(companyId, metricCode, periodStart);
    if (existing) {
      const { data, error } = await this.db()
        .from('company_usage_counters')
        .update({ used_quantity: existing.used_quantity + by })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    const { data, error } = await this.db()
      .from('company_usage_counters')
      .insert({ company_id: companyId, metric_code: metricCode, period_start: periodStart, period_end: periodEnd, used_quantity: by })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async countActiveChannels(companyId: string) {
    const { count } = await this.db()
      .from('whatsapp_channels')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true);
    return count || 0;
  }

  async countActiveTeamMembers(companyId: string) {
    const { count } = await this.db()
      .from('company_users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true);
    return count || 0;
  }

  async countActiveAutomations(companyId: string) {
    const { count } = await this.db()
      .from('automation_rules')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true);
    return count || 0;
  }

  async countContacts(companyId: string) {
    const { count } = await this.db()
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    return count || 0;
  }
}
