import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, company_name } = await req.json();

    if (!email || !password || !full_name || !company_name) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    const admin = getAdminClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) return NextResponse.json({ message: authError.message }, { status: 400 });

    const userId = authData.user.id;

    // 2. Create user profile
    const { error: profileError } = await admin
      .from('users')
      .insert({ id: userId, email, full_name });
    if (profileError) return NextResponse.json({ message: profileError.message }, { status: 400 });

    // 3. Create company
    const { data: company, error: companyError } = await admin
      .from('companies')
      .insert({
        name: company_name,
        slug: generateSlug(company_name),
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (companyError) return NextResponse.json({ message: companyError.message }, { status: 400 });

    // 4. Add user as owner + subscription + AI settings
    await Promise.all([
      admin.from('company_users').insert({ company_id: company.id, user_id: userId, role: 'owner' }),
      admin.from('subscriptions').insert({
        company_id: company.id,
        plan: 'free',
        status: 'trialing',
        current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      admin.from('ai_settings').insert({ company_id: company.id }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Registration failed' }, { status: 500 });
  }
}
