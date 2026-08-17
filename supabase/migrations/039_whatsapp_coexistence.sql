-- WhatsApp Coexistence: lets a customer keep using the WhatsApp Business mobile app
-- on a number while also connecting it to WhatsLark's API (Meta mirrors messages both
-- ways and syncs contacts/history), instead of the standard flow where connecting to
-- the API takes exclusive ownership of the number away from the Business App.
ALTER TABLE whatsapp_channels
  ADD COLUMN IF NOT EXISTS connection_mode TEXT NOT NULL DEFAULT 'api_only'
    CHECK (connection_mode IN ('api_only', 'coexistence'));

-- 'business_app' = sent by the customer themselves from the WhatsApp Business App
-- (mirrored to us as an echo event); NULL = sent via WhatsLark/Cloud API as today.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sent_via TEXT;
