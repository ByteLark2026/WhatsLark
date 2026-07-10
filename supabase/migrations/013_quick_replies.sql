-- Quick replies: saved message shortcuts for inbox
CREATE TABLE quick_replies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shortcut    TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, shortcut)
);

CREATE INDEX quick_replies_company_id ON quick_replies(company_id);

CREATE TRIGGER trg_quick_replies_updated_at
  BEFORE UPDATE ON quick_replies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY quick_replies_company ON quick_replies
  USING (company_id = current_company_id() OR is_super_admin());
