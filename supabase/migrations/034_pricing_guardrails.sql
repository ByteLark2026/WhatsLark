-- AI RFQ Agent — Phase 4: pricing guardrails + manager approval.
-- One pricing_rules row per company (defaults applied in app code when absent).
-- quotations gain an rfq_id back-link and an approval gate for quotes that
-- breach the configured minimum margin.

CREATE TABLE IF NOT EXISTS pricing_rules (
  company_id                   UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  min_margin_pct               NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_limit_pct           NUMERIC(5,2) NOT NULL DEFAULT 100,
  manager_approval_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  below_cost_block             BOOLEAN NOT NULL DEFAULT true,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS rfq_id UUID REFERENCES rfqs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS quotation_approvals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id  UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approver_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL CHECK (status IN ('approved','rejected')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_approvals_quotation ON quotation_approvals(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotations_rfq ON quotations(rfq_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pricing_rules_updated_at') THEN
    CREATE TRIGGER trg_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END $$;

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_rules_company_all ON pricing_rules FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());

CREATE POLICY quotation_approvals_company_all ON quotation_approvals FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());
