-- Templates were being submitted to Meta against whichever active WhatsApp channel
-- Postgres happened to return first (.eq('is_active', true).limit(1)) — non-deterministic
-- for companies with more than one connected number, and nothing recorded afterward which
-- WABA a template actually landed in. Templates are now tied to a specific channel.
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES whatsapp_channels(id) ON DELETE SET NULL;
