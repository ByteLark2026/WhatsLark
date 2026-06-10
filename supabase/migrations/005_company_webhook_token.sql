-- Add webhook_verify_token to companies so it can be verified before any channel is connected
ALTER TABLE companies ADD COLUMN IF NOT EXISTS webhook_verify_token TEXT;
