import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

/** Sends an invoice/quotation link straight into the contact's WhatsApp inbox — finds
 *  (or opens) the conversation for that contact on the company's active WhatsApp
 *  number, sends the text, and logs it as an outbound message so it shows in the inbox
 *  the same as any agent-sent message. */
export async function shareDocumentViaWhatsApp(
  supabase: SupabaseService,
  whatsapp: WhatsAppService,
  params: {
    companyId: string;
    senderId: string;
    contact: { id: string; phone: string; name?: string } | null | undefined;
    docType: 'invoice' | 'quotation';
    docNumber: string;
    total: number;
    currency: string;
    publicToken: string;
  },
): Promise<{ conversationId: string; waMessageId?: string }> {
  const { companyId, senderId, contact, docType, docNumber, total, currency, publicToken } = params;
  if (!contact?.phone) throw new BadRequestException('This document has no linked contact with a phone number');

  const admin = supabase.getAdminClient();

  const { data: channel } = await admin
    .from('whatsapp_channels')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .neq('channel_type', 'widget')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!channel) throw new BadRequestException('No active WhatsApp channel connected for this company');

  const { data: existingConv } = await admin
    .from('conversations')
    .select('id')
    .eq('company_id', companyId)
    .eq('contact_id', contact.id)
    .eq('channel_id', channel.id)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConv?.id as string | undefined;
  if (!conversationId) {
    const { data: created, error } = await admin
      .from('conversations')
      .insert({ company_id: companyId, contact_id: contact.id, channel_id: channel.id, status: 'open', unread_count: 0 })
      .select('id')
      .single();
    if (error || !created) throw new BadRequestException('Could not open a conversation with this contact');
    conversationId = created.id;
  }

  const label = docType === 'invoice' ? 'Invoice' : 'Quotation';
  const link = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${docType === 'invoice' ? 'inv' : 'q'}/${publicToken}`;
  const text = `${label} ${docNumber}\nTotal: ${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nView & download: ${link}`;

  let waMessageId: string | undefined;
  try {
    waMessageId = await whatsapp.sendTextMessage(channel.id, contact.phone, text);
  } catch (err: any) {
    throw new BadRequestException(`WhatsApp send failed: ${err.message}`);
  }

  await admin.from('messages').insert({
    conversation_id: conversationId,
    company_id: companyId,
    channel_id: channel.id,
    direction: 'outbound',
    type: 'text',
    content: text,
    status: 'sent',
    wa_message_id: waMessageId,
    sender_id: senderId,
    is_note: false,
  });

  await admin.from('conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: text.substring(0, 100),
    status: 'open',
  }).eq('id', conversationId);

  return { conversationId, waMessageId };
}
