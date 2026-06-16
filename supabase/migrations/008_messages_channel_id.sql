-- ============================================================
-- Migration 008: Add channel_id to messages for multi-channel routing
-- ============================================================

-- Allow messages to track which WhatsApp channel they came from/went through
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES whatsapp_channels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);

-- Backfill channel_id from the conversation's channel_id for existing rows
UPDATE messages m
SET channel_id = c.channel_id
FROM conversations c
WHERE m.conversation_id = c.id
  AND m.channel_id IS NULL;
