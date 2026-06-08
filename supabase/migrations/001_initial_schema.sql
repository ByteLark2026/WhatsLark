-- ============================================================
-- WhatsLark — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'agent');
CREATE TYPE company_status AS ENUM ('active', 'suspended', 'trial');
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'growth', 'enterprise');
CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'closed');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed');
CREATE TYPE message_type AS ENUM ('text', 'image', 'document', 'audio', 'video', 'location', 'template', 'interactive', 'note');
CREATE TYPE lead_stage AS ENUM ('new_lead', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'running', 'completed', 'paused', 'failed');
CREATE TYPE template_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE automation_trigger AS ENUM ('message_received', 'keyword_matched', 'new_contact');
CREATE TYPE automation_action AS ENUM ('send_message', 'assign_agent', 'add_tag', 'create_lead');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'export');

-- ============================================================
-- COMPANIES (Tenants / Workspaces)
-- ============================================================

CREATE TABLE companies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  status        company_status NOT NULL DEFAULT 'trial',
  plan          subscription_plan NOT NULL DEFAULT 'free',
  logo_url      TEXT,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  country       TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE users (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT NOT NULL,
  avatar_url     TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMPANY USERS (Many-to-many with roles)
-- ============================================================

CREATE TABLE company_users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'agent',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE subscriptions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id               UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan                     subscription_plan NOT NULL DEFAULT 'free',
  status                   subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  stripe_subscription_id   TEXT,
  stripe_customer_id       TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WHATSAPP CHANNELS
-- ============================================================

CREATE TABLE whatsapp_channels (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  phone_number          TEXT NOT NULL,
  phone_number_id       TEXT NOT NULL,
  business_account_id   TEXT NOT NULL,
  access_token          TEXT NOT NULL,           -- encrypted at app layer, never sent to frontend
  webhook_verify_token  TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TAGS
-- ============================================================

CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- ============================================================
-- CONTACTS
-- ============================================================

CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  name          TEXT,
  email         TEXT,
  avatar_url    TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, phone)
);

-- ============================================================
-- CONTACT TAGS
-- ============================================================

CREATE TABLE contact_tags (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================

CREATE TABLE conversations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id           UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_id           UUID NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  assigned_to          UUID REFERENCES users(id) ON DELETE SET NULL,
  status               conversation_status NOT NULL DEFAULT 'open',
  unread_count         INTEGER NOT NULL DEFAULT 0,
  last_message_at      TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONVERSATION TAGS
-- ============================================================

CREATE TABLE conversation_tags (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, tag_id)
);

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  direction       message_direction NOT NULL,
  type            message_type NOT NULL DEFAULT 'text',
  content         TEXT NOT NULL DEFAULT '',
  media_url       TEXT,
  media_type      TEXT,
  status          message_status NOT NULL DEFAULT 'sent',
  wa_message_id   TEXT,                           -- WhatsApp message ID from Meta
  sender_id       UUID REFERENCES users(id),      -- NULL for inbound (contact)
  is_note         BOOLEAN NOT NULL DEFAULT FALSE,
  template_id     UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTES (contact/conversation notes)
-- ============================================================

CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEADS (Sales Pipeline)
-- ============================================================

CREATE TABLE leads (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id         UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id    UUID REFERENCES conversations(id) ON DELETE SET NULL,
  assigned_to        UUID REFERENCES users(id) ON DELETE SET NULL,
  stage              lead_stage NOT NULL DEFAULT 'new_lead',
  title              TEXT NOT NULL,
  deal_value         NUMERIC(12,2),
  currency           TEXT NOT NULL DEFAULT 'USD',
  expected_close_date DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MESSAGE TEMPLATES
-- ============================================================

CREATE TABLE message_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'en_US',
  category      TEXT NOT NULL DEFAULT 'MARKETING',
  status        template_status NOT NULL DEFAULT 'pending',
  wa_template_id TEXT,
  components    JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- ============================================================
-- QUICK REPLIES
-- ============================================================

CREATE TABLE quick_replies (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shortcut   TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, shortcut)
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================

CREATE TABLE campaigns (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_id       UUID NOT NULL REFERENCES whatsapp_channels(id),
  template_id      UUID NOT NULL REFERENCES message_templates(id),
  name             TEXT NOT NULL,
  status           campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count       INTEGER NOT NULL DEFAULT 0,
  delivered_count  INTEGER NOT NULL DEFAULT 0,
  read_count       INTEGER NOT NULL DEFAULT 0,
  failed_count     INTEGER NOT NULL DEFAULT 0,
  replied_count    INTEGER NOT NULL DEFAULT 0,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAMPAIGN RECIPIENTS
-- ============================================================

CREATE TABLE campaign_recipients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status        message_status NOT NULL DEFAULT 'sent',
  wa_message_id TEXT,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  read_at       TIMESTAMPTZ,
  failed_at     TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, contact_id)
);

-- ============================================================
-- AUTOMATION RULES
-- ============================================================

CREATE TABLE automation_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  trigger        automation_trigger NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  actions        JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI SETTINGS
-- ============================================================

CREATE TABLE ai_settings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  is_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reply       BOOLEAN NOT NULL DEFAULT FALSE,
  handover_keyword TEXT NOT NULL DEFAULT 'agent',
  system_prompt    TEXT,
  model            TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- KNOWLEDGE BASE (for AI bot)
-- ============================================================

CREATE TABLE knowledge_base (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     audit_action NOT NULL,
  resource   TEXT NOT NULL,
  resource_id TEXT,
  old_data   JSONB,
  new_data   JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES (performance)
-- ============================================================

CREATE INDEX idx_company_users_company ON company_users(company_id);
CREATE INDEX idx_company_users_user ON company_users(user_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_conversations_company ON conversations(company_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_company ON messages(company_id);
CREATE INDEX idx_messages_wa_id ON messages(wa_message_id);
CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_campaigns_company ON campaigns(company_id);
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_company_users_updated_at BEFORE UPDATE ON company_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_whatsapp_channels_updated_at BEFORE UPDATE ON whatsapp_channels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_message_templates_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_quick_replies_updated_at BEFORE UPDATE ON quick_replies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_automation_rules_updated_at BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ai_settings_updated_at BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
