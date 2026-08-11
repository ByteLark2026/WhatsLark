-- Lets a store connection be pinned to a specific WhatsApp channel, instead of
-- ecommerce.service.ts's getDefaultChannel() picking an arbitrary active channel
-- when a company has more than one connected number.
ALTER TABLE ecommerce_connections
  ADD COLUMN IF NOT EXISTS whatsapp_channel_id UUID REFERENCES whatsapp_channels(id) ON DELETE SET NULL;
