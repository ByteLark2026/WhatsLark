-- Meta App Secret, used to verify X-Hub-Signature-256 on inbound webhook POSTs.
-- Nullable for backward compatibility with channels connected before this was added —
-- the webhook handler only enforces the signature check once a channel has one set.
ALTER TABLE whatsapp_channels
  ADD COLUMN app_secret TEXT;
