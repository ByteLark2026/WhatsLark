import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { email, full_name, role, company_id } = await req.json();

    if (!email || !role || !company_id) {
      return NextResponse.json({ message: 'email, role, and company_id are required' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Find or create the auth user
    let userId: string;
    const { data: existingUser } = await admin.from('users').select('id').eq('email', email).maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
      });
      if (inviteError) return NextResponse.json({ message: inviteError.message }, { status: 400 });

      userId = invited.user.id;

      const { error: profileError } = await admin
        .from('users')
        .insert({ id: userId, email, full_name: full_name || email });
      if (profileError) return NextResponse.json({ message: profileError.message }, { status: 400 });
    }

    // Add to company
    const { data: member, error: memberError } = await admin
      .from('company_users')
      .insert({ company_id, user_id: userId, role })
      .select('*, user:users(*)')
      .single();
    if (memberError) return NextResponse.json({ message: memberError.message }, { status: 400 });

    return NextResponse.json(member);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Invite failed' }, { status: 500 });
  }
}
