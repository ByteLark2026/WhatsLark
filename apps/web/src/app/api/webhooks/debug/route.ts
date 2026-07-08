/**
 * Debug endpoint — helps diagnose webhook issues.
 * GET /api/webhooks/debug?secret=wl-debug-2026   → shows tokens + last received payload
 * POST /api/webhooks/debug?secret=wl-debug-2026  → simulates an inbound message
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEBUG_SECRET = 'wl-debug-2026';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Store last 5 raw webhook payloads in memory (resets on cold start)
const recentPayloads: { ts: string; body: any }[] = [];

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== DEBUG_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Check env vars
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // Fetch channels + their verify tokens
  const { data: channels, error: chErr } = await adminSupabase
    .from('whatsapp_channels')
    .select('id, name, phone_number, phone_number_id, webhook_verify_token, is_active, company_id');

  // Fetch company verify token
  const { data: companies } = await adminSupabase
    .from('companies')
    .select('id, name, webhook_verify_token');

  // Last 5 messages received
  const { data: recentMessages } = await adminSupabase
    .from('messages')
    .select('id, direction, content, wa_message_id, created_at, channel_id')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    env: envCheck,
    webhook_url: 'https://whats-lark.vercel.app/api/webhooks/whatsapp',
    companies: (companies || []).map(c => ({
      id: c.id,
      name: c.name,
      webhook_verify_token: c.webhook_verify_token,
    })),
    channels: (channels || []).map(ch => ({
      id: ch.id,
      name: ch.name,
      phone_number: ch.phone_number,
      phone_number_id: ch.phone_number_id,
      is_active: ch.is_active,
      webhook_verify_token: ch.webhook_verify_token,
    })),
    recent_inbound_messages: recentMessages || [],
    recent_payloads_in_memory: recentPayloads,
    channel_error: chErr?.message,
  });
}

// POST — simulate an inbound message (bypasses Meta, tests the full pipeline)
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== DEBUG_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { phone_number_id, from_phone, message_text } = await req.json();
  if (!phone_number_id || !from_phone || !message_text) {
    return NextResponse.json({ error: 'Need phone_number_id, from_phone, message_text' }, { status: 400 });
  }

  // Build a fake Meta payload
  const fakePayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'fake-waba-id',
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id, display_phone_number: 'test' },
          contacts: [{ wa_id: from_phone.replace(/\D/g, ''), profile: { name: 'Test User' } }],
          messages: [{
            id: `wamid.debug.${Date.now()}`,
            from: from_phone.replace(/\D/g, ''),
            type: 'text',
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: message_text },
          }],
        },
      }],
    }],
  };

  // Call the actual webhook handler
  const webhookRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://whats-lark.vercel.app'}/api/webhooks/whatsapp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakePayload),
    },
  );

  // Wait a moment for async processing
  await new Promise(r => setTimeout(r, 2000));

  // Check if message was stored
  const { data: stored } = await adminSupabase
    .from('messages')
    .select('id, content, direction, wa_message_id, created_at')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1);

  return NextResponse.json({
    simulated_payload: fakePayload,
    webhook_response_status: webhookRes.status,
    most_recent_inbound_message: stored?.[0] || null,
  });
}
