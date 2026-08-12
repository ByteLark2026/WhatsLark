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
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.api_key) return decryptToken(data.api_key);
  return process.env.OPENAI_API_KEY || '';
}
