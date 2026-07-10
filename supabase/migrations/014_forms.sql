-- Lead capture forms
CREATE TABLE forms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  slug          TEXT NOT NULL,
  -- fields: [{id, type, label, placeholder, required, options: []}]
  fields        JSONB NOT NULL DEFAULT '[]',
  -- settings: {submit_button_text, success_message, redirect_url, send_whatsapp, whatsapp_message}
  settings      JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  submit_count  INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, slug)
);

CREATE TABLE form_submissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id      UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data         JSONB NOT NULL DEFAULT '{}',
  contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  ip_address   TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX forms_company_id ON forms(company_id);
CREATE INDEX forms_slug ON forms(slug);
CREATE INDEX form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX form_submissions_company_id ON form_submissions(company_id);
CREATE INDEX form_submissions_submitted_at ON form_submissions(submitted_at DESC);

CREATE TRIGGER trg_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY forms_company ON forms
  USING (company_id = current_company_id() OR is_super_admin());

CREATE POLICY form_submissions_company ON form_submissions
  USING (company_id = current_company_id() OR is_super_admin());
