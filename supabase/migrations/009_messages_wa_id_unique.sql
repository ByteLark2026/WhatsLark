-- Add unique constraint on wa_message_id for proper upsert deduplication.
-- Partial index (WHERE NOT NULL) avoids issues with existing rows that have NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_message_id_unique
  ON messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;
