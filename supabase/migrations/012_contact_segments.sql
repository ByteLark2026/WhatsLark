-- Contact segments (saved filters / static lists)
CREATE TABLE contact_segments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  -- filters JSONB: { tags: ['tag1'], created_after: '2024-01-01', search: 'keyword' }
  -- null = manual/static segment (members controlled by contact_segment_members)
  filters     JSONB,
  contact_count INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Static segment members (for manual lists)
CREATE TABLE contact_segment_members (
  segment_id  UUID NOT NULL REFERENCES contact_segments(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (segment_id, contact_id)
);

CREATE INDEX contact_segments_company_id ON contact_segments(company_id);
CREATE INDEX contact_segment_members_segment_id ON contact_segment_members(segment_id);
CREATE INDEX contact_segment_members_contact_id ON contact_segment_members(contact_id);

CREATE TRIGGER trg_contact_segments_updated_at
  BEFORE UPDATE ON contact_segments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contact_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_segment_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_segments_company ON contact_segments
  USING (company_id = current_company_id() OR is_super_admin());

CREATE POLICY contact_segment_members_company ON contact_segment_members
  USING (segment_id IN (SELECT id FROM contact_segments WHERE company_id = current_company_id()) OR is_super_admin());

-- Store notes on contacts (for automation update node)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
