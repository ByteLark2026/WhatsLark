import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const API_VER = process.env.WHATSAPP_API_VERSION || 'v21.0';

function normalizePhone(phone: string): string {
  // Strip all non-digits
  let p = phone.replace(/\D/g, '');
  // If starts with 0 and is short (local format), we can't fix it — caller must use intl format
  return p;
}

async function sendViaMeta(channel: {
  phone_number_id: string;
  access_token: string;
}, to: string, body: string): Promise<{ wa_message_id?: string; error?: string }> {
  const toNormalized = normalizePhone(to);

  const res = await fetch(
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
        text: { body, preview_url: false },
      }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const code = json.error?.code;
    const msg = json.error?.message || 'Meta API error';
    // Build a human-readable hint for common error codes
    let hint = '';
    if (code === 190) hint = ' [Invalid/expired access token]';
    else if (code === 131047) hint = ' [24h window expired — use a template]';
    else if (code === 131030) hint = ' [Number not whitelisted in test mode]';
    else if (code === 100) hint = ` [Invalid phone "${toNormalized}" — needs country code, e.g. 971XXXXXXXXX]`;
    else if (code === 131026) hint = ' [Message undeliverable to this number]';
    return { error: `[${code}] ${msg}${hint}` };
  }
  return { wa_message_id: json.messages?.[0]?.id };
}


export async function POST(req: NextRequest) {
  try {
    const { conversation_id, message, is_note, sender_id, company_id } = await req.json();

    if (!conversation_id || !message?.trim()) {
      return NextResponse.json({ error: 'conversation_id and message are required' }, { status: 400 });
    }

    // For internal notes — skip WhatsApp, just save to DB
    if (is_note) {
      const { data, error } = await adminSupabase
        .from('messages')
        .insert({
          conversation_id,
          company_id,
          direction: 'outbound',
          type: 'text',
          content: message.trim(),
          status: 'sent',
          sender_id,
          is_note: true,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ message: data });
    }

    // Fetch conversation with channel and contact
    const { data: conv, error: convErr } = await adminSupabase
      .from('conversations')
      .select('*, channel:whatsapp_channels(*), contact:contacts(id, phone)')
      .eq('id', conversation_id)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const channel = conv.channel as {
      id: string;
      phone_number: string;
      phone_number_id: string;
      business_account_id: string;
      access_token: string;
      is_active: boolean;
    };
    const contact = conv.contact as { id: string; phone: string };

    if (!channel?.is_active) {
      return NextResponse.json({ error: 'WhatsApp channel is not active. Check Settings → WhatsApp.' }, { status: 400 });
    }

    if (!contact?.phone) {
      return NextResponse.json({ error: 'Contact has no phone number' }, { status: 400 });
    }

    // Warn if phone looks like local format (no country code)
    const phoneDigits = contact.phone.replace(/\D/g, '');
    if (phoneDigits.startsWith('0') || phoneDigits.length < 10) {
      return NextResponse.json({
        error: `Contact phone "${contact.phone}" appears to be in local format without a country code. WhatsApp requires international format (e.g. 971XXXXXXXXX for UAE, 91XXXXXXXXXX for India). Edit the contact and add the country code.`,
      }, { status: 400 });
    }

    // Save message optimistically as 'sent'
    // channel_id is included if the column exists (migration 008); falls back
    // gracefully so sending works even before the migration is applied.
    let msgRow: any;
    let msgErr: any;
    const withChannel = await adminSupabase
      .from('messages')
      .insert({
        conversation_id,
        company_id: conv.company_id,
        direction: 'outbound',
        type: 'text',
        content: message.trim(),
        status: 'sent',
        sender_id,
        is_note: false,
        channel_id: channel.id,
      })
      .select()
      .single();

    if (withChannel.error?.message?.includes('channel_id')) {
      // Migration 008 not yet applied — retry without channel_id
      const withoutChannel = await adminSupabase
        .from('messages')
        .insert({
          conversation_id,
          company_id: conv.company_id,
          direction: 'outbound',
          type: 'text',
          content: message.trim(),
          status: 'sent',
          sender_id,
          is_note: false,
        })
        .select()
        .single();
      msgRow = withoutChannel.data;
      msgErr = withoutChannel.error;
    } else {
      msgRow = withChannel.data;
      msgErr = withChannel.error;
    }

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    const result = await sendViaMeta(channel, contact.phone, message.trim());

    // Update message status based on API result
    const newStatus = result.error ? 'failed' : 'sent';
    await adminSupabase
      .from('messages')
      .update({
        status: newStatus,
        wa_message_id: result.wa_message_id ?? null,
        ...(result.error ? { error_message: result.error } : {}),
      })
      .eq('id', msgRow.id);

    // Update conversation last_message
    await adminSupabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.trim().slice(0, 100),
      })
      .eq('id', conversation_id);

    if (result.error) {
      return NextResponse.json(
        { message: { ...msgRow, status: 'failed' }, warning: result.error },
        { status: 207 }, // partial success — saved to DB but delivery failed
      );
    }

    return NextResponse.json({ message: { ...msgRow, status: 'sent', wa_message_id: result.wa_message_id } });
  } catch (err: any) {
    console.error('[whatsapp/send]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
