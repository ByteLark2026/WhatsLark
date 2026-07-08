import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── GET — webhook verification (Meta Cloud API) ───────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    // Check company-level token first (this is what the Channels UI shows)
    const { data: companyMatch } = await adminSupabase
      .from('companies')
      .select('id')
      .eq('webhook_verify_token', token)
      .maybeSingle();
    if (companyMatch) return new NextResponse(challenge, { status: 200 });

    // Fall back to per-channel webhook_verify_token (legacy)
    const { data: channelMatch } = await adminSupabase
      .from('whatsapp_channels')
      .select('id')
      .eq('webhook_verify_token', token)
      .maybeSingle();
    if (channelMatch) return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// ── POST — incoming events from Meta ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  console.log('[webhook/whatsapp] POST received, object:', body?.object, 'entries:', body?.entry?.length);
  if (body) {
    // Must await — Vercel serverless terminates after response, so fire-and-forget never completes
    await processWebhookBody(body).catch((err) =>
      console.error('[webhook/whatsapp] processing error:', err),
    );
  }
  return NextResponse.json({ ok: true });
}

// ── Main dispatcher ───────────────────────────────────────────────────────────
async function processWebhookBody(body: any) {
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const { field, value } = change;
      if (!value) continue;

      // Template review status updates
      if (field === 'message_template_status_update') {
        await handleTemplateStatusUpdate(value, entry.id).catch(console.error);
        continue;
      }

      // Route everything else by phone_number_id → channel
      const phoneNumberId: string = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: channel } = await adminSupabase
        .from('whatsapp_channels')
        .select('id, company_id, is_active')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle();

      if (!channel) {
        console.warn(`[webhook] No channel for phone_number_id=${phoneNumberId}`);
        continue;
      }

      if (!channel.is_active) continue;

      // Status updates (delivery receipts) — no message content involved
      for (const status of value.statuses || []) {
        await handleStatusUpdate(status).catch(console.error);
      }

      // Incoming messages
      const waContacts: any[] = value.contacts || [];
      for (const msg of value.messages || []) {
        await handleIncomingMessage(channel.company_id, channel.id, msg, waContacts).catch(
          console.error,
        );
      }
    }
  }
}

// ── Incoming message ──────────────────────────────────────────────────────────
async function handleIncomingMessage(
  companyId: string,
  channelId: string,
  msg: any,
  waContacts: any[],
) {
  console.log('[webhook] handleIncomingMessage companyId:', companyId, 'channelId:', channelId, 'from:', msg.from, 'type:', msg.type);
  // WhatsApp sends phone without '+'; we normalise to E.164 format
  const phone = `+${msg.from}`;
  const waContact = waContacts.find((c: any) => c.wa_id === msg.from);
  const contactName = waContact?.profile?.name || phone;

  // Upsert contact — idempotent, handles race conditions
  const { data: contact } = await adminSupabase
    .from('contacts')
    .upsert(
      {
        company_id: companyId,
        phone,
        name: contactName,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,phone' },
    )
    .select('id, name')
    .single();

  if (!contact) return;

  // Find the most recent non-closed conversation for this contact+channel
  const { data: conversations } = await adminSupabase
    .from('conversations')
    .select('id, unread_count')
    .eq('company_id', companyId)
    .eq('contact_id', contact.id)
    .eq('channel_id', channelId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1);

  let conversation = conversations?.[0] ?? null;

  if (!conversation) {
    const { data: created } = await adminSupabase
      .from('conversations')
      .insert({
        company_id: companyId,
        contact_id: contact.id,
        channel_id: channelId,
        status: 'open',
        unread_count: 0,
      })
      .select('id, unread_count')
      .single();
    conversation = created;
  }

  if (!conversation) return;

  const { type, content, mediaUrl } = extractContent(msg);

  // Deduplicate — wa_message_id has no unique constraint yet, so check manually
  const { data: existing } = await adminSupabase
    .from('messages')
    .select('id')
    .eq('wa_message_id', msg.id)
    .maybeSingle();

  if (!existing) {
    console.log('[webhook] inserting message wa_message_id:', msg.id);
    const { error: insertErr } = await adminSupabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        company_id: companyId,
        channel_id: channelId,
        direction: 'inbound',
        type,
        content,
        media_url: mediaUrl ?? null,
        status: 'delivered',
        wa_message_id: msg.id,
        is_note: false,
        metadata: msg,
      });
    if (insertErr) console.error('[webhook] insert error:', insertErr.message);
    else console.log('[webhook] message inserted OK');
  } else {
    console.log('[webhook] duplicate message, skipping:', msg.id);
  }

  // Update conversation — increment unread_count atomically, reopen if pending
  await adminSupabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: content.substring(0, 100) || `[${type}]`,
      status: 'open',
      unread_count: (conversation.unread_count ?? 0) + 1,
    })
    .eq('id', conversation.id);
}

// ── Delivery/read status updates ──────────────────────────────────────────────
async function handleStatusUpdate(status: any) {
  const waMessageId: string = status.id;
  const rawStatus: string = status.status; // sent | delivered | read | failed

  const validStatuses = ['sent', 'delivered', 'read', 'failed'];
  if (!validStatuses.includes(rawStatus)) return;

  // Update message row
  await adminSupabase
    .from('messages')
    .update({ status: rawStatus })
    .eq('wa_message_id', waMessageId);

  // Update campaign recipient tracking if applicable
  if (['delivered', 'read', 'failed'].includes(rawStatus)) {
    const recipientUpdate: Record<string, any> = { status: rawStatus };
    if (rawStatus === 'delivered') recipientUpdate.delivered_at = new Date().toISOString();
    if (rawStatus === 'read') recipientUpdate.read_at = new Date().toISOString();
    if (rawStatus === 'failed') {
      recipientUpdate.failed_at = new Date().toISOString();
      recipientUpdate.error_message = status.errors?.[0]?.message ?? 'Delivery failed';
    }
    await adminSupabase
      .from('campaign_recipients')
      .update(recipientUpdate)
      .eq('wa_message_id', waMessageId);
  }
}

// ── Content extraction for all WhatsApp message types ────────────────────────
function extractContent(msg: any): { type: string; content: string; mediaUrl?: string } {
  switch (msg.type) {
    case 'text':
      return { type: 'text', content: msg.text?.body ?? '' };

    case 'image':
      return { type: 'image', content: msg.image?.caption ?? '', mediaUrl: msg.image?.id };

    case 'video':
      return { type: 'video', content: msg.video?.caption ?? '', mediaUrl: msg.video?.id };

    case 'audio':
      return { type: 'audio', content: '', mediaUrl: msg.audio?.id };

    case 'voice':
      return { type: 'audio', content: '', mediaUrl: msg.voice?.id };

    case 'document':
      return {
        type: 'document',
        content: msg.document?.filename ?? msg.document?.caption ?? '',
        mediaUrl: msg.document?.id,
      };

    case 'sticker':
      return { type: 'image', content: '[Sticker]', mediaUrl: msg.sticker?.id };

    case 'location':
      return {
        type: 'location',
        content: `${msg.location?.latitude ?? 0},${msg.location?.longitude ?? 0}`,
      };

    case 'contacts':
      return {
        type: 'text',
        content: `[Contact: ${msg.contacts?.[0]?.name?.formatted_name ?? ''}]`,
      };

    case 'reaction':
      return { type: 'text', content: `Reacted ${msg.reaction?.emoji ?? ''}` };

    case 'button':
      return { type: 'text', content: msg.button?.text ?? '' };

    case 'interactive':
      return {
        type: 'text',
        content:
          msg.interactive?.list_reply?.title ??
          msg.interactive?.button_reply?.title ??
          '[Interactive response]',
      };

    case 'order':
      return { type: 'text', content: '[Order received]' };

    case 'system':
      return { type: 'text', content: msg.system?.body ?? '[System message]' };

    default:
      return { type: 'text', content: `[${msg.type ?? 'Unknown'}]` };
  }
}

// ── Template approval / rejection callbacks ───────────────────────────────────
async function handleTemplateStatusUpdate(value: any, wabaId?: string) {
  const templateId = value?.message_template_id?.toString();
  const name = value?.message_template_name;
  const language = value?.message_template_language;
  const status = mapMetaTemplateStatus(value?.event);
  if (!templateId || !name) return;

  // Narrow to the company that owns this WABA
  let companyIds: string[] | null = null;
  if (wabaId) {
    const { data: channels } = await adminSupabase
      .from('whatsapp_channels')
      .select('company_id')
      .eq('business_account_id', wabaId);
    companyIds = (channels ?? []).map((c: any) => c.company_id);
  }

  // Match by wa_template_id first (most reliable)
  let q = adminSupabase
    .from('message_templates')
    .update({ status })
    .eq('wa_template_id', templateId);
  if (companyIds?.length) q = q.in('company_id', companyIds);
  const { data: byId } = await q.select('id');
  if (byId && byId.length > 0) return;

  // Fall back to name+language match and also store the id for future use
  let fb = adminSupabase
    .from('message_templates')
    .update({ status, wa_template_id: templateId })
    .eq('name', name)
    .eq('language', language);
  if (companyIds?.length) fb = fb.in('company_id', companyIds);
  await fb;
}

function mapMetaTemplateStatus(event?: string): 'pending' | 'approved' | 'rejected' {
  switch ((event ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
    case 'FLAGGED':
      return 'rejected';
    default:
      return 'pending';
  }
}
