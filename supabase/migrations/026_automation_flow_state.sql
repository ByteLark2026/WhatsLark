-- askQuestion nodes were sending the question and immediately continuing to the next
-- node in the same pass, instead of actually waiting for the customer's reply — a
-- multi-question flow fired every message in one burst with nothing captured. This
-- table tracks which node a conversation is paused at, so the next inbound message
-- resumes the flow instead of re-triggering it from scratch.
CREATE TABLE IF NOT EXISTS automation_flow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  resume_node_id TEXT NOT NULL,
  awaiting_variable TEXT,
  vars JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
