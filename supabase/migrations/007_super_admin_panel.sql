-- ============================================================
-- WhatsLark — Super Admin Panel: new entities
-- Migration: 007_super_admin_panel.sql
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE notification_audience AS ENUM ('all', 'companies', 'users');
CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE transaction_type AS ENUM ('subscription', 'addon', 'refund', 'manual');
CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE support_ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE app_platform AS ENUM ('android', 'ios', 'web');

-- ============================================================
-- SUBSCRIPTION PLANS (admin-configurable plan catalog)
-- ============================================================

CREATE TABLE subscription_plans (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     TEXT NOT NULL UNIQUE,
  slug                     TEXT NOT NULL UNIQUE,
  price_monthly            NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly             NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'USD',
  max_users                INTEGER,
  max_channels             INTEGER,
  max_contacts             INTEGER,
  max_messages_per_month   INTEGER,
  features                 JSONB NOT NULL DEFAULT '[]',
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS (platform-wide admin announcements)
-- ============================================================

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  severity          notification_severity NOT NULL DEFAULT 'info',
  audience          notification_audience NOT NULL DEFAULT 'all',
  target_company_ids UUID[],
  is_published      BOOLEAN NOT NULL DEFAULT TRUE,
  published_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS (billing/payment records)
-- ============================================================

CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount            NUMERIC(10,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  type              transaction_type NOT NULL DEFAULT 'subscription',
  status            transaction_status NOT NULL DEFAULT 'pending',
  payment_method    TEXT,
  gateway_reference TEXT,
  description       TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================

CREATE TABLE support_tickets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  status       support_ticket_status NOT NULL DEFAULT 'open',
  priority     support_ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE support_ticket_replies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- APP VERSIONS (mobile/app update announcements)
-- ============================================================

CREATE TABLE app_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform        app_platform NOT NULL,
  version         TEXT NOT NULL,
  build_number    INTEGER,
  release_notes   TEXT,
  download_url    TEXT,
  is_force_update BOOLEAN NOT NULL DEFAULT FALSE,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,
  released_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, version)
);

-- ============================================================
-- PAYMENT GATEWAY SETTINGS
-- ============================================================

CREATE TABLE payment_gateway_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider        TEXT NOT NULL UNIQUE,
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  is_test_mode    BOOLEAN NOT NULL DEFAULT TRUE,
  public_key      TEXT,
  secret_key      TEXT,
  webhook_secret  TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_transactions_company ON transactions(company_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_company ON support_tickets(company_id);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX idx_support_ticket_replies_ticket ON support_ticket_replies(ticket_id);
CREATE INDEX idx_notifications_published ON notifications(is_published, created_at DESC);
CREATE INDEX idx_app_versions_platform ON app_versions(platform, released_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_app_versions_updated_at BEFORE UPDATE ON app_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payment_gateway_settings_updated_at BEFORE UPDATE ON payment_gateway_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_plans_super_admin_all ON subscription_plans FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY subscription_plans_select_active ON subscription_plans FOR SELECT
  USING (is_active = TRUE OR is_super_admin());

CREATE POLICY notifications_super_admin_all ON notifications FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY transactions_super_admin_all ON transactions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY support_tickets_super_admin_all ON support_tickets FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY support_tickets_company_select ON support_tickets FOR SELECT
  USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY support_tickets_company_insert ON support_tickets FOR INSERT
  WITH CHECK (is_super_admin() OR company_id = current_company_id());

CREATE POLICY support_ticket_replies_super_admin_all ON support_ticket_replies FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY support_ticket_replies_select ON support_ticket_replies FOR SELECT
  USING (is_super_admin() OR ticket_id IN (SELECT id FROM support_tickets WHERE company_id = current_company_id()));

CREATE POLICY app_versions_super_admin_all ON app_versions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY app_versions_select_published ON app_versions FOR SELECT
  USING (is_published = TRUE OR is_super_admin());

CREATE POLICY payment_gateway_settings_super_admin_all ON payment_gateway_settings FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
