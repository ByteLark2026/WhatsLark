import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const API_VER = process.env.WHATSAPP_API_VERSION || 'v21.0';

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get('channel_id');
  const testTo = req.nextUrl.searchParams.get('to'); // optional: phone to test-send to

  if (!channelId) {
    return NextResponse.json({ error: 'channel_id query param required' }, { status: 400 });
  }

  // 1. Env check
  const envCheck = {
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || '(not set — defaulting to v21.0)',
  };

  // 2. Fetch channel
  const { data: channel, error: channelErr } = await adminSupabase
    .from('whatsapp_channels')
    .select('*')
    .eq('id', channelId)
    .single();

  if (channelErr || !channel) {
    return NextResponse.json({
      env: envCheck,
      error: `Channel not found: ${channelErr?.message}`,
    }, { status: 404 });
  }

  const checks: Record<string, any> = {};

  // 3. Verify access token via Meta phone number info endpoint
  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VER}/${channel.phone_number_id}?fields=id,display_phone_number,verified_name,status,quality_rating,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${channel.access_token}` } },
    );
    const json = await res.json();
    if (res.ok) {
      checks.token = {
        ok: true,
        display_phone_number: json.display_phone_number,
        verified_name: json.verified_name,
        status: json.status,
        quality_rating: json.quality_rating,
        messaging_limit_tier: json.messaging_limit_tier,
      };
    } else {
      checks.token = {
        ok: false,
        error_message: json.error?.message,
        error_code: json.error?.code,
        error_subcode: json.error?.error_subcode,
        error_type: json.error?.type,
        fix: json.error?.code === 190
          ? 'Access token is invalid or expired. Re-add the channel with a valid permanent access token.'
          : 'Check access token permissions (requires whatsapp_business_messaging scope).',
      };
    }
  } catch (e: any) {
    checks.token = { ok: false, error_message: e.message };
  }

  // 4. Check schema — does messages.channel_id column exist?
  try {
    const { error: schemaErr } = await adminSupabase
      .from('messages')
      .select('channel_id')
      .limit(1);
    checks.schema_channel_id = {
      ok: !schemaErr,
      detail: schemaErr?.message || 'column exists',
      fix: schemaErr ? 'Run migration 008_messages_channel_id.sql in Supabase SQL Editor.' : null,
    };
  } catch (e: any) {
    checks.schema_channel_id = { ok: false, detail: e.message };
  }

  // 5. Optional test send
  if (testTo && checks.token?.ok) {
    const toNormalized = testTo.replace(/\D/g, '');
    const phoneWarning = toNormalized.startsWith('0') || toNormalized.length < 10
      ? `Phone "${toNormalized}" looks like a local number without country code. WhatsApp requires international format (e.g. 971XXXXXXXXX for UAE).`
      : null;

    try {
      const sendRes = await fetch(
        `https://graph.facebook.com/${API_VER}/${channel.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${channel.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toNormalized,
            type: 'text',
            text: { body: '✅ WhatsLark diagnostic test message', preview_url: false },
          }),
        },
      );
      const sendJson = await sendRes.json();
      if (sendRes.ok) {
        checks.test_send = {
          ok: true,
          message_id: sendJson.messages?.[0]?.id,
          to: toNormalized,
          warning: phoneWarning,
        };
      } else {
        checks.test_send = {
          ok: false,
          to: toNormalized,
          phone_warning: phoneWarning,
          error_message: sendJson.error?.message,
          error_code: sendJson.error?.code,
          error_subcode: sendJson.error?.error_subcode,
          fix: sendJson.error?.code === 131047
            ? '24-hour messaging window expired. Use a template message to re-engage.'
            : sendJson.error?.code === 131030
            ? 'Recipient not in test whitelist. Add them in Meta App → WhatsApp → Test numbers, or move app to production.'
            : sendJson.error?.code === 100
            ? `Invalid phone number format. Use international format without + (e.g. 971XXXXXXXXX). Got: ${toNormalized}`
            : 'See error_code for details.',
        };
      }
    } catch (e: any) {
      checks.test_send = { ok: false, to: toNormalized, error_message: e.message };
    }
  } else if (testTo && !checks.token?.ok) {
    checks.test_send = { ok: false, skipped: 'Token check failed — fix token first before test send.' };
  }

  return NextResponse.json({
    env: envCheck,
    channel: {
      id: channel.id,
      name: channel.name,
      phone_number: channel.phone_number,
      phone_number_id: channel.phone_number_id,
      is_active: channel.is_active,
      has_access_token: !!channel.access_token,
      has_meta_app_id: !!channel.meta_app_id,
    },
    checks,
    api_version_used: API_VER,
  });
}
