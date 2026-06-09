import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── GET — webhook verification (Meta & 360dialog) ──────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    // Verify token must match one of our channel's webhook_verify_token
    const { data } = await adminSupabase
      .from('whatsapp_channels')
      .select('id')
      .eq('webhook_verify_token', token)
      .single();

    if (data) return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// ── POST — incoming messages ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Meta / 360dialog format ──
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value?.messages) continue;

          const phoneNumberId = value.metadata?.phone_number_id;

          // Find our channel by phone_number_id
          const { data: channel } = await adminSupabase
            .from('whatsapp_channels')
            .select('id, company_id')
            .eq('phone_number_id', phoneNumberId)
            .single();

          if (!channel) continue;

          for (const msg of value.messages) {
            const fromPhone = `+${msg.from}`;
            const content =
              msg.type === 'text' ? msg.text?.body :
              msg.type === 'image' ? '[Image]' :
              msg.type === 'video' ? '[Video]' :
              msg.type === 'document' ? '[Document]' :
              msg.type === 'audio' ? '[Voice message]' :
              `[${msg.type}]`;

            await upsertIncomingMessage(channel.company_id, channel.id, fromPhone, content, msg.id);
          }

          // Mark messages as read (delivery receipts)
          for (const status of value.statuses || []) {
            await adminSupabase
              .from('messages')
              .update({ status: status.status === 'read' ? 'read' : status.status === 'delivered' ? 'delivered' : 'sent' })
              .eq('wa_message_id', status.id);
          }
        }
      }
    }

    // ── Twilio format ──
    if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const from = formData.get('From') as string;
      const to = formData.get('To') as string;
      const body2 = formData.get('Body') as string;
      const msgSid = formData.get('MessageSid') as string;

      const toNumber = to.replace('whatsapp:', '');
      const { data: channel } = await adminSupabase
        .from('whatsapp_channels')
        .select('id, company_id')
        .eq('phone_number', toNumber)
        .single();

      if (channel) {
        await upsertIncomingMessage(channel.company_id, channel.id, from.replace('whatsapp:', ''), body2, msgSid);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[webhook/whatsapp]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function upsertIncomingMessage(
  companyId: string,
  channelId: string,
  fromPhone: string,
  content: string,
  waMessageId: string,
) {
  // Find or create contact
  let { data: contact } = await adminSupabase
    .from('contacts')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone', fromPhone)
    .single();

  if (!contact) {
    const { data: newContact } = await adminSupabase
      .from('contacts')
      .insert({ company_id: companyId, phone: fromPhone, name: fromPhone })
      .select('id')
      .single();
    contact = newContact;
  }

  if (!contact) return;

  // Find or create conversation
  let { data: conv } = await adminSupabase
    .from('conversations')
    .select('id')
    .eq('company_id', companyId)
    .eq('contact_id', contact.id)
    .eq('channel_id', channelId)
    .eq('status', 'open')
    .single();

  if (!conv) {
    const { data: newConv } = await adminSupabase
      .from('conversations')
      .insert({
        company_id: companyId,
        contact_id: contact.id,
        channel_id: channelId,
        status: 'open',
        unread_count: 1,
      })
      .select('id')
      .single();
    conv = newConv;
  }

  if (!conv) return;

  // Insert message (skip duplicate wa_message_id)
  await adminSupabase
    .from('messages')
    .upsert(
      {
        conversation_id: conv.id,
        company_id: companyId,
        channel_id: channelId,
        direction: 'inbound',
        type: 'text',
        content,
        status: 'delivered',
        wa_message_id: waMessageId,
        is_note: false,
      },
      { onConflict: 'wa_message_id', ignoreDuplicates: true },
    );

  // Update conversation counters
  await adminSupabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: content?.slice(0, 100),
      unread_count: adminSupabase.rpc('increment', { x: 1 }) as any,
    })
    .eq('id', conv.id);
}
