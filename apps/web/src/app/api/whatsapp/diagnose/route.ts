import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/token-crypto';

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
  channel.access_token = decryptToken(channel.access_token);
  channel.app_secret = channel.app_secret ? decryptToken(channel.app_secret) : channel.app_secret;

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

  // 3b. Check whether our app is subscribed to this WABA's webhooks, and which fields
  if (checks.token?.ok && channel.business_account_id) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${API_VER}/${channel.business_account_id}/subscribed_apps`,
        { headers: { Authorization: `Bearer ${channel.access_token}` } },
      );
      const json = await res.json();
      if (res.ok) {
        const apps: any[] = json.data || [];
        // A WABA is rarely subscribed to more than one app; match by meta_app_id when we
        // have one, but fall back to "any subscribed app has messages" rather than showing
        // a false negative when the stored app id doesn't exactly match Meta's response.
        const appId = channel.meta_app_id;
        const matchedApp = appId ? apps.find((a) => a.whatsapp_business_api_data?.id === appId) : undefined;
        const fields: string[] = matchedApp
          ? matchedApp.subscribed_fields || []
          : Array.from(new Set(apps.flatMap((a) => a.subscribed_fields || [])));
        const hasMessages = fields.includes('messages');
        checks.webhook_subscription = {
          ok: apps.length > 0 && hasMessages,
          subscribed_app_count: apps.length,
          fields,
          business_account_id: channel.business_account_id,
          raw: apps.length === 0 ? json : undefined,
          fix: apps.length === 0
            ? 'No app subscribed to this WABA. Click "Subscribe webhook" to fix.'
            : !hasMessages
            ? '"messages" field not subscribed — status/delivery updates will never arrive. Click "Subscribe webhook" to fix.'
            : null,
        };
      } else {
        checks.webhook_subscription = {
          ok: false,
          error_message: json.error?.message,
          error_code: json.error?.code,
          fix: 'Could not read subscription state — check business_account_id and token permissions (whatsapp_business_management scope).',
        };
      }
    } catch (e: any) {
      checks.webhook_subscription = { ok: false, error_message: e.message };
    }
  }

  // 3c. Check app-level webhook field config directly (separate from the WABA-attach check above).
  // Tells us whether meta_app_id/app_secret are even present, and if not, whether the
  // app-level POST /{app-id}/subscriptions has ever succeeded and with which fields.
  if (channel.meta_app_id && channel.app_secret) {
    try {
      const appAccessToken = `${channel.meta_app_id}|${channel.app_secret}`;
      const res = await fetch(
        `https://graph.facebook.com/${API_VER}/${channel.meta_app_id}/subscriptions?access_token=${encodeURIComponent(appAccessToken)}`,
      );
      const json = await res.json();
      if (res.ok) {
        const subs: any[] = json.data || [];
        const wabaSub = subs.find((s) => s.object === 'whatsapp_business_account');
        checks.app_level_config = {
          ok: !!wabaSub?.fields?.some((f: any) => f.name === 'messages'),
          all_subscriptions: subs.map((s) => ({ object: s.object, callback_url: s.callback_url, fields: (s.fields || []).map((f: any) => f.name) })),
          fix: !wabaSub ? 'App has no "whatsapp_business_account" subscription at all — app-level webhook was never configured.' : null,
        };
      } else {
        checks.app_level_config = {
          ok: false,
          error_message: json.error?.message,
          error_code: json.error?.code,
          fix: json.error?.code === 190
            ? 'app_secret is wrong/invalid for this meta_app_id — app access token rejected.'
            : 'Could not read app-level subscription config.',
        };
      }
    } catch (e: any) {
      checks.app_level_config = { ok: false, error_message: e.message };
    }
  } else {
    checks.app_level_config = {
      ok: false,
      skipped: true,
      fix: !channel.meta_app_id
        ? 'No meta_app_id stored on this channel — app-level webhook subscribe cannot run.'
        : 'No app_secret stored on this channel — app-level webhook subscribe cannot run.',
    };
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

// Sets which fields the app receives for the "whatsapp_business_account" object.
// This is app-level config (Meta App Dashboard → Webhooks), not per-WABA — a WABA can be
// attached to the app (subscribed_apps) yet still receive zero fields if this was never set.
async function subscribeAppLevelFields(channel: any, origin: string, verifyToken: string) {
  if (!channel.meta_app_id || !channel.app_secret) {
    return { attempted: false, reason: 'No meta_app_id/app_secret stored — set up webhook fields manually in Meta App Dashboard.' };
  }
  const appSecret = decryptToken(channel.app_secret);
  const appAccessToken = `${channel.meta_app_id}|${appSecret}`;
  const callbackUrl = `${origin}/api/webhooks/whatsapp`;
  const params = new URLSearchParams({
    object: 'whatsapp_business_account',
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: 'messages',
    access_token: appAccessToken,
  });
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VER}/${channel.meta_app_id}/subscriptions?${params}`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      return { attempted: true, ok: false, error_message: json.error?.message, error_code: json.error?.code };
    }
    return { attempted: true, ok: true, success: json.success };
  } catch (e: any) {
    return { attempted: true, ok: false, error_message: e.message };
  }
}

async function subscribeChannel(channel: any, origin: string) {
  if (!channel.business_account_id) {
    return { ok: false, channel_id: channel.id, name: channel.name, error_message: 'No business_account_id set.' };
  }
  const accessToken = decryptToken(channel.access_token);

  const { data: companyRow } = await adminSupabase
    .from('companies')
    .select('webhook_verify_token')
    .eq('id', channel.company_id)
    .single();
  const verifyToken = companyRow?.webhook_verify_token || channel.webhook_verify_token || '';

  const appLevel = await subscribeAppLevelFields(channel, origin, verifyToken);

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VER}/${channel.business_account_id}/subscribed_apps`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, channel_id: channel.id, name: channel.name, error_message: json.error?.message, error_code: json.error?.code, app_level: appLevel };
    }
    return { ok: true, channel_id: channel.id, name: channel.name, success: json.success, app_level: appLevel };
  } catch (e: any) {
    return { ok: false, channel_id: channel.id, name: channel.name, error_message: e.message, app_level: appLevel };
  }
}

// Subscribe our app to a WABA's webhooks (fixes "messages" field not subscribed).
// Pass { channel_id } for a single channel, or { all: true } to fix every channel that has a WABA.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const origin = req.nextUrl.origin;

  if (body.all) {
    const { data: channels, error } = await adminSupabase
      .from('whatsapp_channels')
      .select('*')
      .eq('channel_type', 'whatsapp')
      .not('business_account_id', 'is', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];
    for (const channel of channels || []) {
      results.push(await subscribeChannel(channel, origin));
    }
    return NextResponse.json({ results });
  }

  const channelId = body.channel_id;
  if (!channelId) {
    return NextResponse.json({ error: 'channel_id or all required' }, { status: 400 });
  }

  const { data: channel, error: channelErr } = await adminSupabase
    .from('whatsapp_channels')
    .select('*')
    .eq('id', channelId)
    .single();

  if (channelErr || !channel) {
    return NextResponse.json({ error: `Channel not found: ${channelErr?.message}` }, { status: 404 });
  }

  const result = await subscribeChannel(channel, origin);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
