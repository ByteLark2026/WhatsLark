import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class WidgetService {
  constructor(private readonly supabase: SupabaseService) {}

  private async getOrCreateWidgetChannel(companyId: string) {
    const admin = this.supabase.getAdminClient();
    const { data: existing } = await admin
      .from('whatsapp_channels')
      .select('id')
      .eq('company_id', companyId)
      .eq('channel_type', 'widget')
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await admin
      .from('whatsapp_channels')
      .insert({
        company_id: companyId,
        name: 'Website Chat Widget',
        channel_type: 'widget',
        phone_number: 'widget',
        phone_number_id: `widget:${companyId}`,
        business_account_id: 'widget',
        access_token: '',
        webhook_verify_token: randomUUID(),
        is_active: true,
      })
      .select('id')
      .single();

    if (error || !created) throw new BadRequestException('Could not initialize widget channel');
    return created.id;
  }

  /** Start a new visitor session, or resume one given a valid conversationId + visitorToken. */
  async start(siteId: string, resume?: { conversationId: string; visitorToken: string }) {
    const admin = this.supabase.getAdminClient();

    const { data: company } = await admin.from('companies').select('id').eq('id', siteId).maybeSingle();
    if (!company) throw new NotFoundException('Unknown siteId');

    if (resume?.conversationId && resume?.visitorToken) {
      const { data: existing } = await admin
        .from('conversations')
        .select('id, visitor_token')
        .eq('id', resume.conversationId)
        .eq('company_id', siteId)
        .eq('visitor_token', resume.visitorToken)
        .maybeSingle();
      if (existing) return { conversationId: existing.id, visitorToken: existing.visitor_token };
    }

    const channelId = await this.getOrCreateWidgetChannel(siteId);
    const visitorToken = randomUUID();

    const { data: contact, error: contactErr } = await admin
      .from('contacts')
      .insert({
        company_id: siteId,
        phone: `widget:${randomUUID()}`,
        name: 'Website Visitor',
      })
      .select('id')
      .single();
    if (contactErr || !contact) throw new BadRequestException('Could not start session');

    const { data: conversation, error: convErr } = await admin
      .from('conversations')
      .insert({
        company_id: siteId,
        contact_id: contact.id,
        channel_id: channelId,
        status: 'open',
        unread_count: 0,
        visitor_token: visitorToken,
      })
      .select('id')
      .single();
    if (convErr || !conversation) throw new BadRequestException('Could not start session');

    return { conversationId: conversation.id, visitorToken };
  }

  private async assertOwnsConversation(siteId: string, conversationId: string, visitorToken: string) {
    const admin = this.supabase.getAdminClient();
    const { data } = await admin
      .from('conversations')
      .select('id, unread_count')
      .eq('id', conversationId)
      .eq('company_id', siteId)
      .eq('visitor_token', visitorToken)
      .maybeSingle();
    if (!data) throw new NotFoundException('Conversation not found');
    return data;
  }

  async sendMessage(siteId: string, conversationId: string, visitorToken: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('Message content required');
    const conversation = await this.assertOwnsConversation(siteId, conversationId, visitorToken);
    const admin = this.supabase.getAdminClient();

    const { data: message, error } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        company_id: siteId,
        direction: 'inbound',
        type: 'text',
        content: content.trim(),
        status: 'delivered',
        is_note: false,
      })
      .select()
      .single();
    if (error || !message) throw new BadRequestException('Could not send message');

    await admin
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.trim().substring(0, 100),
        unread_count: conversation.unread_count + 1,
        status: 'open',
      })
      .eq('id', conversationId);

    return message;
  }

  async getMessages(siteId: string, conversationId: string, visitorToken: string, after?: string) {
    await this.assertOwnsConversation(siteId, conversationId, visitorToken);
    const admin = this.supabase.getAdminClient();

    let query = admin
      .from('messages')
      .select('id, direction, content, type, created_at')
      .eq('conversation_id', conversationId)
      .eq('is_note', false)
      .order('created_at', { ascending: true });

    if (after) query = query.gt('created_at', after);

    const { data, error } = await query;
    if (error) throw new BadRequestException('Could not fetch messages');
    return data;
  }
}
