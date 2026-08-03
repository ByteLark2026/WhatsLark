import { SupabaseClient } from '@supabase/supabase-js';

// In-memory TTL cache for user_id -> company_id resolution. This is the single
// most-repeated query in the app (every authenticated request does it, either via
// CompanyGuard or a controller's own getCompanyId() helper), and Supabase's
// hosted DB adds real network latency per call — this cache removes that cost
// for repeat requests within the TTL window at the price of up to TTL_MS of lag
// on role/company-membership changes (e.g. deactivation) taking effect.
const TTL_MS = 30_000;
const cache = new Map<string, { companyId: string; expires: number }>();

export async function resolveCompanyId(
  supabase: SupabaseClient,
  userId: string,
  requestedId?: string,
): Promise<string | undefined> {
  const cacheKey = `${userId}:${requestedId || ''}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.companyId;

  const { data } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq(requestedId ? 'company_id' : 'is_active', requestedId || true)
    .limit(1)
    .single();

  if (!data) {
    cache.delete(cacheKey);
    return undefined;
  }

  cache.set(cacheKey, { companyId: data.company_id, expires: Date.now() + TTL_MS });
  return data.company_id;
}
