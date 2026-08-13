-- Store WhatsApp delivery-failure reason on the message itself, not just campaign_recipients.
ALTER TABLE messages ADD COLUMN error_message TEXT;
