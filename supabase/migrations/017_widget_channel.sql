-- ============================================================
-- WEBSITE CHAT WIDGET
-- ============================================================
-- Adds support for a company's embeddable website chat widget,
-- reusing the existing conversations/messages tables via a
-- synthetic whatsapp_channels row (channel_type = 'widget').

ALTER TABLE whatsapp_channels
  ADD COLUMN channel_type TEXT NOT NULL DEFAULT 'whatsapp';

ALTER TABLE conversations
  ADD COLUMN visitor_token UUID UNIQUE;

CREATE INDEX idx_conversations_visitor_token ON conversations(visitor_token) WHERE visitor_token IS NOT NULL;
