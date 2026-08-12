import { SupabaseClient } from '@supabase/supabase-js';
import { decryptToken } from './token-crypto';

/** Most-recently-added active key for the given provider, from the admin-managed
 *  ai_provider_keys table (mirrors apps/api/src/common/ai-key.util.ts). Falls back to
 *  OPENAI_API_KEY so existing deployments with no keys configured in the table keep
 *  working unchanged. */
export async function resolveAiProviderKey(supabase: SupabaseClient, provider: string = 'openai'): Promise<string> {
  const { data } = await supabase
    .from('ai_provider_keys')
    .select('api_key')
    .eq('provider', provider)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Try each active key newest-first — a row can become undecryptable if
  // TOKEN_ENCRYPTION_KEY changes after it was saved; don't let that break AI calls
  // entirely when a newer, valid key (or the env var) is available.
  for (const row of data || []) {
    try {
      const key = decryptToken(row.api_key);
      if (key) return key;
    } catch { /* try the next one */ }
  }
  return process.env.OPENAI_API_KEY || '';
}
