-- AI RFQ Agent — Phase 1: detection/extraction tables + feature flag.
-- SKU matching, pricing rules, quotation approvals and ERP adapters land in later phases.

ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS rfq_agent_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS product_catalog (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  name           TEXT NOT NULL,
  aliases        TEXT[] NOT NULL DEFAULT '{}',
  cost           NUMERIC(12,2),
  standard_price NUMERIC(12,2),
  currency       TEXT NOT NULL DEFAULT 'AED',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, sku)
);

CREATE TABLE IF NOT EXISTS rfqs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_review','quoted','expired')),
  source          TEXT NOT NULL DEFAULT 'whatsapp_text',
  raw_message     TEXT NOT NULL,
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfq_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id             UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  raw_text           TEXT NOT NULL,
  quantity           NUMERIC(12,2),
  unit               TEXT,
  matched_product_id UUID REFERENCES product_catalog(id) ON DELETE SET NULL,
  matched_sku        TEXT,
  confidence         NUMERIC(5,2),
  status             TEXT NOT NULL DEFAULT 'needs_review' CHECK (status IN ('auto_matched','needs_review','unmatched')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_company ON product_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_company ON rfqs(company_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_company ON rfq_items(company_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_catalog_updated_at') THEN
    CREATE TRIGGER trg_product_catalog_updated_at BEFORE UPDATE ON product_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rfqs_updated_at') THEN
    CREATE TRIGGER trg_rfqs_updated_at BEFORE UPDATE ON rfqs FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END $$;

ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_catalog_company_all ON product_catalog FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());

CREATE POLICY rfqs_company_all ON rfqs FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());

CREATE POLICY rfq_items_company_all ON rfq_items FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());
