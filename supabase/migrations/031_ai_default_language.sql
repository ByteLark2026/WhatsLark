ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'auto';
