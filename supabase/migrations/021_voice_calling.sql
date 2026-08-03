-- ============================================================
-- VOICE CALLING (Twilio)
-- ============================================================

CREATE TABLE voice_channels (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone_number    TEXT NOT NULL,
  account_sid     TEXT NOT NULL,
  auth_token      TEXT NOT NULL,   -- encrypted at app layer (token-crypto.util), never sent to frontend
  api_key_sid     TEXT NOT NULL,
  api_key_secret  TEXT NOT NULL,   -- encrypted at app layer, never sent to frontend
  twiml_app_sid   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE call_status AS ENUM ('queued', 'ringing', 'in-progress', 'completed', 'no-answer', 'busy', 'failed', 'voicemail');
CREATE TYPE call_handled_by AS ENUM ('agent', 'ai', 'voicemail');

CREATE TABLE calls (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voice_channel_id  UUID REFERENCES voice_channels(id) ON DELETE SET NULL,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id           UUID REFERENCES leads(id) ON DELETE SET NULL,
  agent_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  direction         call_direction NOT NULL,
  from_number       TEXT NOT NULL,
  to_number         TEXT NOT NULL,
  status            call_status NOT NULL DEFAULT 'queued',
  handled_by        call_handled_by,
  duration_seconds  INTEGER,
  recording_url     TEXT,
  recording_sid     TEXT,
  transcript        TEXT,
  notes             TEXT,
  twilio_call_sid   TEXT NOT NULL UNIQUE,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_company_contact ON calls(company_id, contact_id);
CREATE INDEX idx_calls_company_lead ON calls(company_id, lead_id);
CREATE INDEX idx_calls_twilio_sid ON calls(twilio_call_sid);
CREATE INDEX idx_voice_channels_company ON voice_channels(company_id);

ALTER TABLE company_users
  ADD COLUMN is_available_for_calls BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_voice_channels_updated_at') THEN
    CREATE TRIGGER trg_voice_channels_updated_at BEFORE UPDATE ON voice_channels FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calls_updated_at') THEN
    CREATE TRIGGER trg_calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END $$;
