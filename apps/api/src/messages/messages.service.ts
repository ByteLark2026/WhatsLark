import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async sendMessage(companyId: string, senderId: string, dto: {
    conversation_id: string;
    message: string;
    type?: string;
  }) {
    // Get conversation + contact
    const { data: conv, error: convErr } = await this.supabase.getAdminClient()
      .from('conversations')
      .select('*, contacts (phone), whatsapp_channels:channel_id (id)')
      .eq('id', dto.conversation_id)
      .eq('company_id', companyId)
      .single();

    if (convErr || !conv) throw new BadRequestException('Conversation not found');

    const phone = conv.contacts.phone;
    const channelId = conv.whatsapp_channels.id;

    // Send via WhatsApp API
    let waMessageId: string | undefined;
    try {
      waMessageId = await this.whatsapp.sendTextMessage(channelId, phone, dto.message);
    } catch (err: any) {
      throw new BadRequestException(`WhatsApp send failed: ${err.message}`);
    }

    // Save to DB
    const { data: message, error } = await this.supabase.getAdminClient()
      .from('messages')
      .insert({
        conversation_id: dto.conversation_id,
        company_id: companyId,
        direction: 'outbound',
        type: dto.type || 'text',
        content: dto.message,
        status: 'sent',
        wa_message_id: waMessageId,
        sender_id: senderId,
        is_note: false,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Update conversation last message
    await this.supabase.getAdminClient()
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: dto.message.substring(0, 100),
      })
      .eq('id', dto.conversation_id);

    return message;
  }

  async getQuickReplies(companyId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('quick_replies')
      .select('*')
      .eq('company_id', companyId)
      .order('shortcut');
    return data;
  }

  async createQuickReply(companyId: string, userId: string, dto: { shortcut: string; message: string }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('quick_replies')
      .insert({ company_id: companyId, created_by: userId, ...dto })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteQuickReply(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('quick_replies')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }
}
