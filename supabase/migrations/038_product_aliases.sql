-- Company-level synonym table so RFQ matching can bridge customer wording ("surgical
-- masks") to catalog wording ("LOMAR Face Mask 3Ply...") without editing the ERP's own
-- product text. Populated by an AI batch job (source='ai_generated') and/or learned
-- from manual review corrections (source='manual_review') over time.
CREATE TABLE IF NOT EXISTS product_aliases (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku          TEXT NOT NULL,
  product_name TEXT NOT NULL,
  alias        TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'ai_generated',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, sku, alias)
);

CREATE INDEX IF NOT EXISTS idx_product_aliases_company ON product_aliases(company_id);

ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_aliases_company_all ON product_aliases FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());
