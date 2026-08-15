-- AI RFQ Agent — ERP/commerce adapter registry. One connection row per
-- company+provider; credentials are stored encrypted (token-crypto.util.ts),
-- never plaintext. Adapters read config (non-secret) + decrypted credentials.

CREATE TABLE IF NOT EXISTS integration_connections (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL CHECK (provider IN ('business_central','odoo','woocommerce','shopify','zoho','custom_rest')),
  name         TEXT NOT NULL DEFAULT '',
  config       JSONB NOT NULL DEFAULT '{}',
  credentials  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_company ON integration_connections(company_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_integration_connections_updated_at') THEN
    CREATE TRIGGER trg_integration_connections_updated_at BEFORE UPDATE ON integration_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END $$;

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_connections_company_all ON integration_connections FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());
