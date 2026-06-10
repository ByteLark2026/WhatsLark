-- Optional Meta App ID, used for the resumable upload API when submitting
-- message templates with media headers (IMAGE/VIDEO/DOCUMENT) for review.
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS meta_app_id TEXT;
