-- Lets super admin manage multiple AI provider API keys (e.g. several OpenAI keys) instead
-- of a single OPENAI_API_KEY env var baked into the deployment. The most-recently-added
-- active key for a provider is used; env var stays as the fallback when the table is empty,
-- so existing deployments keep working with zero config.
CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'openai',
  label TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
