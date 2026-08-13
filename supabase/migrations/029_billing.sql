-- ============================================================
-- WhatsLark — Billing (Razorpay subscriptions)
-- Migration: 029_billing.sql
--
-- Tenant-facing subscription billing, separate from the existing admin-only
-- subscription_plans/transactions/payment_gateway_settings tables (007) which
-- remain untouched. Money is always stored as an integer in the smallest
-- currency unit (paise for INR) — never floating point.
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');

CREATE TYPE billing_subscription_status AS ENUM (
  'pending',       -- created locally, not yet authenticated by Razorpay Checkout
  'authenticated', -- subscription.authenticated — mandate captured, not yet active
  'active',        -- subscription.activated / subscription.charged
  'pending_payment', -- subscription.pending — inside grace period
  'halted',        -- subscription.halted — grace period exhausted
  'paused',        -- subscription.paused
  'cancelled',      -- subscription.cancelled
  'completed'       -- subscription.completed — fixed-count plan finished
);

CREATE TYPE billing_payment_status AS ENUM ('created', 'captured', 'failed', 'refunded');

CREATE TYPE billing_webhook_processing_status AS ENUM ('received', 'processed', 'skipped', 'failed');

-- ============================================================
-- BILLING PLANS (logical plan catalog: starter / professional / business)
-- ============================================================

CREATE TABLE billing_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE, -- 'starter' | 'professional' | 'business'
  name          TEXT NOT NULL,
  description   TEXT,
  -- Entitlements as data, not scattered constants. -1 means "unlimited".
  -- Shape: { whatsapp_channels, team_members, automations, contacts, ai_credits_monthly, api_access }
  features      JSONB NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BILLING PRICES (a plan x interval x provider combination)
-- The frontend only ever sends this row's id ("billing_price_id") — never a
-- trusted amount or provider_plan_id. The backend loads both from here.
-- ============================================================

CREATE TABLE billing_prices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'razorpay',
  provider_plan_id  TEXT NOT NULL, -- Razorpay Plan ID (plan_xxx) — placeholder until real plans are created in Razorpay Dashboard
  billing_interval  billing_interval NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR',
  amount_minor      INTEGER NOT NULL CHECK (amount_minor >= 0), -- paise
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_plan_id)
);

-- ============================================================
-- BILLING SUBSCRIPTIONS (one company's subscription lifecycle)
-- ============================================================

CREATE TABLE billing_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  billing_price_id          UUID NOT NULL REFERENCES billing_prices(id),
  provider                  TEXT NOT NULL DEFAULT 'razorpay',
  provider_subscription_id  TEXT UNIQUE, -- Razorpay subscription id (sub_xxx); null until created at provider
  provider_customer_id      TEXT,
  status                    billing_subscription_status NOT NULL DEFAULT 'pending',
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  next_charge_at            TIMESTAMPTZ,
  grace_ends_at             TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at              TIMESTAMPTZ,
  ended_at                  TIMESTAMPTZ,
  created_by_user_id        UUID REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one non-terminal subscription per company at a time — prevents
-- accidental duplicate active subscriptions (enforced again in application code).
CREATE UNIQUE INDEX billing_subscriptions_one_active_per_company
  ON billing_subscriptions (company_id)
  WHERE status IN ('pending', 'authenticated', 'active', 'pending_payment', 'halted', 'paused');

-- ============================================================
-- BILLING PAYMENTS (Razorpay payment/invoice history)
-- ============================================================

CREATE TABLE billing_payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  billing_subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
  provider_payment_id     TEXT UNIQUE NOT NULL, -- Razorpay payment id (pay_xxx)
  provider_invoice_id     TEXT,
  amount_minor            INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency                TEXT NOT NULL DEFAULT 'INR',
  status                  billing_payment_status NOT NULL DEFAULT 'created',
  payment_method          TEXT,
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BILLING WEBHOOK EVENTS (idempotency ledger for Razorpay webhooks)
-- ============================================================

CREATE TABLE billing_webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL DEFAULT 'razorpay',
  provider_event_id   TEXT NOT NULL, -- x-razorpay-event-id header
  event_type          TEXT NOT NULL,
  processing_status   billing_webhook_processing_status NOT NULL DEFAULT 'received',
  provider_created_at TIMESTAMPTZ,
  processed_at        TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

-- ============================================================
-- COMPANY USAGE COUNTERS (periodic usage against plan entitlements)
-- ============================================================

CREATE TABLE company_usage_counters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric_code   TEXT NOT NULL, -- e.g. 'ai_credits'
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  used_quantity INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, metric_code, period_start)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_billing_prices_plan_id ON billing_prices(plan_id);
CREATE INDEX idx_billing_subscriptions_company_id ON billing_subscriptions(company_id);
CREATE INDEX idx_billing_subscriptions_status ON billing_subscriptions(status);
CREATE INDEX idx_billing_payments_company_id ON billing_payments(company_id);
CREATE INDEX idx_billing_payments_subscription_id ON billing_payments(billing_subscription_id);
CREATE INDEX idx_billing_payments_created_at ON billing_payments(created_at DESC);
CREATE INDEX idx_billing_webhook_events_status ON billing_webhook_events(processing_status);
CREATE INDEX idx_company_usage_counters_company_metric ON company_usage_counters(company_id, metric_code);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER trg_billing_plans_updated_at BEFORE UPDATE ON billing_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_billing_prices_updated_at BEFORE UPDATE ON billing_prices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_billing_subscriptions_updated_at BEFORE UPDATE ON billing_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_billing_payments_updated_at BEFORE UPDATE ON billing_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_company_usage_counters_updated_at BEFORE UPDATE ON company_usage_counters FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- All backend writes go through the service-role client (bypasses RLS) —
-- these policies are defense-in-depth for any RLS-respecting client.
-- ============================================================

ALTER TABLE billing_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_prices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_usage_counters   ENABLE ROW LEVEL SECURITY;

-- Plans/prices are a public catalog (needed for the pricing page) but only
-- super admins (via the backend service role) can write them.
CREATE POLICY billing_plans_select ON billing_plans FOR SELECT
  USING (active = TRUE OR is_super_admin());
CREATE POLICY billing_plans_admin_write ON billing_plans FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY billing_prices_select ON billing_prices FOR SELECT
  USING (active = TRUE OR is_super_admin());
CREATE POLICY billing_prices_admin_write ON billing_prices FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Subscriptions: company members may read their own company's subscription;
-- only the backend (service role) or super admin may write — no direct
-- insert/update policy for regular company roles, mutations always flow
-- through the BillingService / webhook handler using the admin client.
CREATE POLICY billing_subscriptions_select ON billing_subscriptions FOR SELECT
  USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY billing_subscriptions_admin_write ON billing_subscriptions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY billing_payments_select ON billing_payments FOR SELECT
  USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY billing_payments_admin_write ON billing_payments FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Webhook events contain no tenant data and are never read by the frontend.
CREATE POLICY billing_webhook_events_admin_only ON billing_webhook_events FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY company_usage_counters_select ON company_usage_counters FOR SELECT
  USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY company_usage_counters_admin_write ON company_usage_counters FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============================================================
-- SEED DATA — placeholder plans/prices
--
-- ⚠ AMOUNTS AND provider_plan_id VALUES ARE PLACEHOLDERS.
-- Before going live:
--   1. Create matching Plans in Razorpay Dashboard (Test mode first) for
--      each row below (monthly + yearly, INR).
--   2. Replace provider_plan_id with the real Razorpay Plan ID (plan_xxx).
--   3. Replace amount_minor with the real price in paise (e.g. ₹999 = 99900).
-- See docs/razorpay-billing.md for the full walkthrough.
-- ============================================================

INSERT INTO billing_plans (code, name, description, features, display_order) VALUES
  ('starter', 'Starter', 'For small teams getting started with WhatsApp CRM.', '{
    "whatsapp_channels": 1,
    "team_members": 2,
    "automations": 5,
    "contacts": 2000,
    "ai_credits_monthly": 200,
    "api_access": false
  }'::jsonb, 1),
  ('professional', 'Professional', 'For growing teams that need more automation and reach.', '{
    "whatsapp_channels": 3,
    "team_members": 10,
    "automations": 25,
    "contacts": 10000,
    "ai_credits_monthly": 2000,
    "api_access": true
  }'::jsonb, 2),
  ('business', 'Business', 'For larger organizations with configurable limits.', '{
    "whatsapp_channels": 10,
    "team_members": 50,
    "automations": 100,
    "contacts": 50000,
    "ai_credits_monthly": 10000,
    "api_access": true
  }'::jsonb, 3);

-- Placeholder INR prices (paise) — REPLACE before production use.
INSERT INTO billing_prices (plan_id, provider, provider_plan_id, billing_interval, currency, amount_minor)
SELECT id, 'razorpay', 'plan_PLACEHOLDER_STARTER_MONTHLY', 'monthly', 'INR', 99900   FROM billing_plans WHERE code = 'starter';
INSERT INTO billing_prices (plan_id, provider, provider_plan_id, billing_interval, currency, amount_minor)
SELECT id, 'razorpay', 'plan_PLACEHOLDER_STARTER_YEARLY', 'yearly', 'INR', 999000    FROM billing_plans WHERE code = 'starter';
INSERT INTO billing_prices (plan_id, provider, provider_plan_id, billing_interval, currency, amount_minor)
SELECT id, 'razorpay', 'plan_PLACEHOLDER_PROFESSIONAL_MONTHLY', 'monthly', 'INR', 249900 FROM billing_plans WHERE code = 'professional';
INSERT INTO billing_prices (plan_id, provider, provider_plan_id, billing_interval, currency, amount_minor)
SELECT id, 'razorpay', 'plan_PLACEHOLDER_PROFESSIONAL_YEARLY', 'yearly', 'INR', 2499000  FROM billing_plans WHERE code = 'professional';
INSERT INTO billing_prices (plan_id, provider, provider_plan_id, billing_interval, currency, amount_minor)
SELECT id, 'razorpay', 'plan_PLACEHOLDER_BUSINESS_MONTHLY', 'monthly', 'INR', 599900   FROM billing_plans WHERE code = 'business';
INSERT INTO billing_prices (plan_id, provider, provider_plan_id, billing_interval, currency, amount_minor)
SELECT id, 'razorpay', 'plan_PLACEHOLDER_BUSINESS_YEARLY', 'yearly', 'INR', 5999000    FROM billing_plans WHERE code = 'business';
