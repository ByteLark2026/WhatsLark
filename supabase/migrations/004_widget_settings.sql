-- ============================================================
-- WhatsLark — Widget Settings Table
-- Migration: 004_widget_settings.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS widget_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Welcome!',
  subtitle        text NOT NULL DEFAULT 'How can we help?',
  site_name       text NOT NULL DEFAULT 'My Site Name',
  allowed_domain  text,
  chat_greeting   text NOT NULL DEFAULT 'Hi! How can I help you today?',
  response_time   text NOT NULL DEFAULT 'A few minutes',
  primary_color   text NOT NULL DEFAULT '#25d366',
  accent_color    text NOT NULL DEFAULT '#128c7e',
  logo_url        text,
  position        text NOT NULL DEFAULT 'bottom-right',
  style_preset    text NOT NULL DEFAULT 'modern',
  button_text     text NOT NULL DEFAULT 'Send us a message',
  search_placeholder text NOT NULL DEFAULT 'Search our Help Center',
  faqs_count      text NOT NULL DEFAULT '3',
  show_team_avatars boolean NOT NULL DEFAULT true,
  show_recent_faqs  boolean NOT NULL DEFAULT true,
  live_chat       boolean NOT NULL DEFAULT true,
  ai_auto_reply   boolean NOT NULL DEFAULT true,
  font_family     text NOT NULL DEFAULT 'System Default',
  button_style    text NOT NULL DEFAULT 'Solid Fill',
  shadow_intensity text NOT NULL DEFAULT 'Medium',
  animation_speed  text NOT NULL DEFAULT 'Normal',
  team_members    jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE widget_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "widget_settings_company_access" ON widget_settings
  USING (company_id = current_company_id());

CREATE POLICY "widget_settings_company_insert" ON widget_settings
  FOR INSERT WITH CHECK (company_id = current_company_id());

CREATE POLICY "widget_settings_company_update" ON widget_settings
  FOR UPDATE USING (company_id = current_company_id());

-- Auto-update updated_at
CREATE TRIGGER trg_widget_settings_updated_at
  BEFORE UPDATE ON widget_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
