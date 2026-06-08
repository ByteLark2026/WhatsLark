-- ============================================================
-- WhatsLark — Row Level Security Policies
-- Migration: 002_row_level_security.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_channels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: get the current user's company_id
-- (used inside RLS policies — avoids subqueries per row)
-- ============================================================

CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
  SELECT company_id
  FROM company_users
  WHERE user_id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_super_admin, FALSE)
  FROM users
  WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_role(p_company_id UUID, required_roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_users
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND is_active = TRUE
      AND role = ANY(required_roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE POLICY companies_select ON companies FOR SELECT
  USING (
    is_super_admin()
    OR id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY companies_insert ON companies FOR INSERT
  WITH CHECK (is_super_admin() OR TRUE); -- anyone can create a company during registration

CREATE POLICY companies_update ON companies FOR UPDATE
  USING (
    is_super_admin()
    OR user_has_role(id, ARRAY['owner','admin']::user_role[])
  );

-- ============================================================
-- USERS
-- ============================================================

CREATE POLICY users_select ON users FOR SELECT
  USING (
    is_super_admin()
    OR id = auth.uid()
    OR id IN (
      SELECT cu.user_id FROM company_users cu
      WHERE cu.company_id = current_company_id() AND cu.is_active = TRUE
    )
  );

CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (id = auth.uid()); -- only insert own profile

CREATE POLICY users_update ON users FOR UPDATE
  USING (id = auth.uid() OR is_super_admin());

-- ============================================================
-- COMPANY USERS
-- ============================================================

CREATE POLICY company_users_select ON company_users FOR SELECT
  USING (
    is_super_admin()
    OR company_id = current_company_id()
  );

CREATE POLICY company_users_insert ON company_users FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR user_has_role(company_id, ARRAY['owner','admin']::user_role[])
    OR user_id = auth.uid() -- self-join
  );

CREATE POLICY company_users_update ON company_users FOR UPDATE
  USING (
    is_super_admin()
    OR user_has_role(company_id, ARRAY['owner','admin']::user_role[])
  );

-- ============================================================
-- Macro: company-scoped table policy generator
-- (SELECT, INSERT, UPDATE, DELETE all scoped to company_id)
-- ============================================================

-- SUBSCRIPTIONS
CREATE POLICY subscriptions_select ON subscriptions FOR SELECT
  USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY subscriptions_all ON subscriptions FOR ALL
  USING (is_super_admin());

-- WHATSAPP CHANNELS
CREATE POLICY channels_select ON whatsapp_channels FOR SELECT
  USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY channels_insert ON whatsapp_channels FOR INSERT
  WITH CHECK (is_super_admin() OR (company_id = current_company_id() AND user_has_role(company_id, ARRAY['owner','admin']::user_role[])));
CREATE POLICY channels_update ON whatsapp_channels FOR UPDATE
  USING (is_super_admin() OR (company_id = current_company_id() AND user_has_role(company_id, ARRAY['owner','admin']::user_role[])));
CREATE POLICY channels_delete ON whatsapp_channels FOR DELETE
  USING (is_super_admin() OR (company_id = current_company_id() AND user_has_role(company_id, ARRAY['owner','admin']::user_role[])));

-- TAGS
CREATE POLICY tags_select ON tags FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY tags_insert ON tags FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY tags_update ON tags FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY tags_delete ON tags FOR DELETE USING (is_super_admin() OR company_id = current_company_id());

-- CONTACTS
CREATE POLICY contacts_select ON contacts FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (is_super_admin() OR company_id = current_company_id());

-- CONTACT TAGS
CREATE POLICY contact_tags_all ON contact_tags FOR ALL
  USING (contact_id IN (SELECT id FROM contacts WHERE company_id = current_company_id()));

-- CONVERSATIONS
CREATE POLICY conversations_select ON conversations FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY conversations_insert ON conversations FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY conversations_update ON conversations FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());

-- CONVERSATION TAGS
CREATE POLICY conversation_tags_all ON conversation_tags FOR ALL
  USING (conversation_id IN (SELECT id FROM conversations WHERE company_id = current_company_id()));

-- MESSAGES
CREATE POLICY messages_select ON messages FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY messages_update ON messages FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());

-- NOTES
CREATE POLICY notes_select ON notes FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY notes_insert ON notes FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY notes_update ON notes FOR UPDATE USING (is_super_admin() OR (company_id = current_company_id() AND created_by = auth.uid()));
CREATE POLICY notes_delete ON notes FOR DELETE USING (is_super_admin() OR (company_id = current_company_id() AND created_by = auth.uid()));

-- LEADS
CREATE POLICY leads_select ON leads FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY leads_update ON leads FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY leads_delete ON leads FOR DELETE USING (is_super_admin() OR company_id = current_company_id());

-- MESSAGE TEMPLATES
CREATE POLICY templates_select ON message_templates FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY templates_insert ON message_templates FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY templates_update ON message_templates FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY templates_delete ON message_templates FOR DELETE USING (is_super_admin() OR company_id = current_company_id());

-- QUICK REPLIES
CREATE POLICY quick_replies_select ON quick_replies FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY quick_replies_insert ON quick_replies FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY quick_replies_update ON quick_replies FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY quick_replies_delete ON quick_replies FOR DELETE USING (is_super_admin() OR company_id = current_company_id());

-- CAMPAIGNS
CREATE POLICY campaigns_select ON campaigns FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY campaigns_insert ON campaigns FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY campaigns_update ON campaigns FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());

-- CAMPAIGN RECIPIENTS
CREATE POLICY campaign_recipients_select ON campaign_recipients FOR SELECT
  USING (campaign_id IN (SELECT id FROM campaigns WHERE company_id = current_company_id()));
CREATE POLICY campaign_recipients_insert ON campaign_recipients FOR INSERT
  WITH CHECK (campaign_id IN (SELECT id FROM campaigns WHERE company_id = current_company_id()));
CREATE POLICY campaign_recipients_update ON campaign_recipients FOR UPDATE
  USING (campaign_id IN (SELECT id FROM campaigns WHERE company_id = current_company_id()));

-- AUTOMATION RULES
CREATE POLICY automation_select ON automation_rules FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY automation_insert ON automation_rules FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY automation_update ON automation_rules FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY automation_delete ON automation_rules FOR DELETE USING (is_super_admin() OR company_id = current_company_id());

-- AI SETTINGS
CREATE POLICY ai_settings_select ON ai_settings FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY ai_settings_insert ON ai_settings FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY ai_settings_update ON ai_settings FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());

-- KNOWLEDGE BASE
CREATE POLICY kb_select ON knowledge_base FOR SELECT USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY kb_insert ON knowledge_base FOR INSERT WITH CHECK (is_super_admin() OR company_id = current_company_id());
CREATE POLICY kb_update ON knowledge_base FOR UPDATE USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY kb_delete ON knowledge_base FOR DELETE USING (is_super_admin() OR company_id = current_company_id());

-- AUDIT LOGS (read-only for members, full access for super admin)
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (is_super_admin() OR company_id = current_company_id());
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (TRUE); -- backend service role inserts these
