-- AI RFQ Agent — Phase 6: no-response follow-up.
-- rfq_followup_hours = 0 disables follow-up; follow_up_sent_at prevents re-sending.

ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS rfq_followup_hours INTEGER NOT NULL DEFAULT 0;

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;
