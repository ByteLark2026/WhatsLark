-- 0 = disabled (default). When > 0, an RFQ where every item matched at or above this
-- confidence gets a quotation generated (and sent, if rfq_auto_send is also on)
-- automatically, with no human review step.
ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS rfq_auto_quote_confidence NUMERIC(5,2) NOT NULL DEFAULT 0;
