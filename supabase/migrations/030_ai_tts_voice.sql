ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS tts_voice text NOT NULL DEFAULT 'alloy';
