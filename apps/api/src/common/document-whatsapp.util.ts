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
    senderId: string | null;
    contact: { id: string; phone: string; name?: string } | null | undefined;
    docType: 'invoice' | 'quotation';
    docNumber: string;
    total: number;
    currency: string;
    publicToken: string;
    /** When provided and the 24h window is open, sent as an actual WhatsApp document
     *  instead of a text link. Outside the window this is ignored — template messages
     *  can't carry a dynamic attachment without their own approved document header,
     *  which none of the templates here have. */
    pdfBuffer?: Buffer;
  },
): Promise<{ conversationId: string; waMessageId?: string }> {
  const { companyId, senderId, contact, docType, docNumber, total, currency, publicToken, pdfBuffer } = params;
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

  // WhatsApp only allows free-form sends within 24h of the customer's last inbound
  // message. Outside that window, only an approved template can reach them.
  const { data: lastInbound } = await admin
    .from('messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const windowOpen = !!lastInbound && (Date.now() - new Date(lastInbound.created_at).getTime()) < 24 * 60 * 60 * 1000;

  let waMessageId: string | undefined;
  let sentContent = text;
  let sentType: 'text' | 'template' | 'document' = 'text';

  if (windowOpen && pdfBuffer) {
    try {
      const filename = `${label}-${docNumber}.pdf`;
      const mediaId = await whatsapp.uploadDocument(channel.id, pdfBuffer, filename);
      waMessageId = await whatsapp.sendDocumentMessage(channel.id, contact.phone, mediaId, filename, `${label} ${docNumber} — ${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      sentContent = `[${filename}] ${label} ${docNumber}`;
      sentType = 'document';
    } catch (err: any) {
      throw new BadRequestException(`WhatsApp PDF send failed: ${err.message}`);
    }
  } else if (windowOpen) {
    try {
      waMessageId = await whatsapp.sendTextMessage(channel.id, contact.phone, text);
    } catch (err: any) {
      throw new BadRequestException(`WhatsApp send failed: ${err.message}`);
    }
  } else {
    const templateName = `${docType}_followup`;
    const { data: template } = await admin
      .from('message_templates')
      .select('name, language, components')
      .eq('company_id', companyId)
      .eq('name', templateName)
      .eq('status', 'approved')
      .maybeSingle();
    if (!template) {
      throw new BadRequestException(
        `The 24-hour WhatsApp window is closed for this contact and no approved "${templateName}" template is configured — create and get it approved in Templates first.`,
      );
    }
    const components = [{
      type: 'body',
      parameters: [{ type: 'text', text: contact.name || 'there' }, { type: 'text', text: docNumber }],
    }];
    try {
      waMessageId = await whatsapp.sendTemplateMessage(channel.id, contact.phone, template.name, template.language, components);
    } catch (err: any) {
      throw new BadRequestException(`WhatsApp template send failed: ${err.message}`);
    }
    sentContent = `[Template: ${templateName}] Hello ${contact.name || 'there'}, following up on ${label.toLowerCase()} ${docNumber}.`;
    sentType = 'template';
  }

  await admin.from('messages').insert({
    conversation_id: conversationId,
    company_id: companyId,
    channel_id: channel.id,
    direction: 'outbound',
    type: sentType,
    content: sentContent,
    status: 'sent',
    wa_message_id: waMessageId,
    sender_id: senderId,
    is_note: false,
  });

  await admin.from('conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: sentContent.substring(0, 100),
    status: 'open',
  }).eq('id', conversationId);

  return { conversationId, waMessageId };
}
