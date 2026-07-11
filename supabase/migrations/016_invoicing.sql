-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_token   UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id        UUID REFERENCES leads(id) ON DELETE SET NULL,
  number         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  line_items     JSONB NOT NULL DEFAULT '[]',
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'AED',
  due_date       DATE,
  notes          TEXT,
  sent_at        TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, number)
);

-- Quotations
CREATE TABLE IF NOT EXISTS quotations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_token         UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id              UUID REFERENCES leads(id) ON DELETE SET NULL,
  number               TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','converted')),
  line_items           JSONB NOT NULL DEFAULT '[]',
  subtotal             NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate             NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'AED',
  valid_until          DATE,
  notes                TEXT,
  terms                TEXT,
  sent_at              TIMESTAMPTZ,
  accepted_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_company ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_contact ON quotations(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(company_id, status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoices_updated_at') THEN
    CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quotations_updated_at') THEN
    CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END $$;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_company_all ON invoices FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());

CREATE POLICY quotations_company_all ON quotations FOR ALL
  USING (company_id = current_company_id() OR is_super_admin())
  WITH CHECK (company_id = current_company_id() OR is_super_admin());
