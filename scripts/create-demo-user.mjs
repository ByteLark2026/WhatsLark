import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — set them in apps/api/.env or your shell environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function createDemoUser() {
  console.log('Creating demo user: demo@whatslark.com ...')

  // Check if user already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'demo@whatslark.com')
    .maybeSingle()

  if (existing) {
    console.log('Demo user already exists, skipping.')
    return
  }

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'demo@whatslark.com',
    password: 'demo123456',
    email_confirm: true,
  })

  if (authError) {
    console.error('Auth error:', authError.message)
    process.exit(1)
  }

  const userId = authData.user.id
  console.log('Auth user created:', userId)

  // 2. Create user profile
  const { error: profileError } = await supabase
    .from('users')
    .insert({ id: userId, email: 'demo@whatslark.com', full_name: 'Demo User' })

  if (profileError) {
    console.error('Profile error:', profileError.message)
    process.exit(1)
  }

  // 3. Create demo company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: 'Demo Company',
      slug: 'demo-company',
      status: 'trial',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (companyError) {
    console.error('Company error:', companyError.message)
    process.exit(1)
  }

  console.log('Company created:', company.id)

  // 4. Add user as owner
  await supabase.from('company_users').insert({
    company_id: company.id,
    user_id: userId,
    role: 'owner',
  })

  // 5. Create subscription
  await supabase.from('subscriptions').insert({
    company_id: company.id,
    plan: 'free',
    status: 'trialing',
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  // 6. Create AI settings
  await supabase.from('ai_settings').insert({ company_id: company.id })

  console.log('✅ Demo user created successfully!')
  console.log('   Email:    demo@whatslark.com')
  console.log('   Password: demo123456')
  console.log('   Company:  Demo Company')
}

createDemoUser().catch(console.error)
