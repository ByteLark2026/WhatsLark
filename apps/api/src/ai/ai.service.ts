import { Injectable, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(private readonly supabase: SupabaseService) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async getSettings(companyId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('ai_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateSettings(companyId: string, dto: {
    is_enabled?: boolean;
    auto_reply?: boolean;
    handover_keyword?: string;
    system_prompt?: string;
    model?: string;
  }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('ai_settings')
      .upsert({ company_id: companyId, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async suggestReply(companyId: string, conversationId: string): Promise<string> {
    const settings = await this.getSettings(companyId);
    if (!settings.is_enabled) return '';

    // Get last N messages for context
    const { data: messages } = await this.supabase.getAdminClient()
      .from('messages')
      .select('direction, content, created_at')
      .eq('conversation_id', conversationId)
      .eq('is_note', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!messages?.length) return '';

    // Build knowledge base context
    const { data: kb } = await this.supabase.getAdminClient()
      .from('knowledge_base')
      .select('question, answer')
      .eq('company_id', companyId)
      .eq('is_active', true);

    const kbContext = kb?.map(k => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n') || '';

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${settings.system_prompt || 'You are a helpful customer support assistant.'}\n\n${kbContext ? `Knowledge Base:\n${kbContext}` : ''}`,
      },
      ...messages.reverse().map(m => ({
        role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
    ];

    const completion = await this.openai.chat.completions.create({
      model: settings.model || 'gpt-4o-mini',
      messages: chatMessages,
      max_tokens: 300,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '';
  }

  async autoReply(companyId: string, conversationId: string, incomingMessage: string): Promise<string | null> {
    const settings = await this.getSettings(companyId);
    if (!settings.is_enabled || !settings.auto_reply) return null;

    // Check for human handover keyword
    if (incomingMessage.toLowerCase().includes(settings.handover_keyword?.toLowerCase() || 'agent')) {
      return null; // Let human handle it
    }

    return this.suggestReply(companyId, conversationId);
  }

  // Knowledge Base CRUD
  async listKnowledgeBase(companyId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('knowledge_base')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at');
    return data;
  }

  async addKnowledge(companyId: string, dto: { question: string; answer: string }) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('knowledge_base')
      .insert({ company_id: companyId, ...dto })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateKnowledge(companyId: string, id: string, dto: any) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('knowledge_base')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteKnowledge(companyId: string, id: string) {
    await this.supabase.getAdminClient()
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    return { success: true };
  }
}
