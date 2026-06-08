import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly adminClient: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Regular client — respects RLS
    this.client = createClient(url, anonKey);

    // Service-role client — bypasses RLS (backend use only)
    this.adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Use for user-scoped queries (respects RLS with JWT) */
  getClient(): SupabaseClient {
    return this.client;
  }

  /** Use for server-side operations that bypass RLS */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /** Create a client scoped to a user's JWT token */
  getClientWithToken(accessToken: string): SupabaseClient {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
}
