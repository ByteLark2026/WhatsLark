import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { SupabaseService } from '../common/supabase.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { TemplatesService } from '../templates/templates.service';
import { resolveAiProviderKey } from '../common/ai-key.util';

const POSTER_BUCKET = 'ai-posters';

@Injectable()
export class AiPosterService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly whatsapp: WhatsAppService,
    private readonly templates: TemplatesService,
  ) {}

  private async ensureBucket() {
    const admin = this.supabase.getAdminClient();
    const { data } = await admin.storage.getBucket(POSTER_BUCKET);
    if (!data) {
      await admin.storage.createBucket(POSTER_BUCKET, { public: true });
    }
  }

  private async uploadBase64(companyId: string, base64: string): Promise<string> {
    await this.ensureBucket();
    const admin = this.supabase.getAdminClient();
    const path = `${companyId}/${Date.now()}.png`;
    const buffer = Buffer.from(base64, 'base64');

    const { error } = await admin.storage.from(POSTER_BUCKET).upload(path, buffer, {
      contentType: 'image/png',
      upsert: false,
    });
    if (error) throw new BadRequestException(`Poster upload failed: ${error.message}`);

    const { data } = admin.storage.from(POSTER_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async generate(companyId: string, prompt: string, provider: 'openai' | 'gemini' = 'openai'): Promise<{ imageUrl: string }> {
    if (!prompt?.trim()) throw new BadRequestException('Prompt is required');

    const base64 = provider === 'gemini'
      ? await this.generateWithGemini(prompt)
      : await this.generateWithOpenAi(prompt);

    const imageUrl = await this.uploadBase64(companyId, base64);
    return { imageUrl };
  }

  private async generateWithOpenAi(prompt: string): Promise<string> {
    const apiKey = await resolveAiProviderKey(this.supabase.getAdminClient(), 'openai');
    if (!apiKey) throw new BadRequestException('No OpenAI API key configured');

    const openai = new OpenAI({ apiKey });
    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new BadRequestException('OpenAI returned no image');
    return b64;
  }

  private async generateWithGemini(prompt: string): Promise<string> {
    const apiKey = await resolveAiProviderKey(this.supabase.getAdminClient(), 'gemini');
    if (!apiKey) throw new BadRequestException('No Gemini API key configured');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );

    if (!response.ok) throw new BadRequestException(`Gemini image generation failed: ${await response.text()}`);
    const json: any = await response.json();
    const b64 = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!b64) throw new BadRequestException('Gemini returned no image');
    return b64;
  }

  async sendToContact(companyId: string, dto: { contactId: string; channelId: string; imageUrl: string; caption?: string }) {
    const admin = this.supabase.getAdminClient();
    const { data: contact, error } = await admin
      .from('contacts')
      .select('phone')
      .eq('id', dto.contactId)
      .eq('company_id', companyId)
      .single();
    if (error || !contact) throw new NotFoundException('Contact not found');

    const { data: channel } = await admin
      .from('whatsapp_channels')
      .select('id')
      .eq('id', dto.channelId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!channel) throw new NotFoundException('Channel not found');

    const waMessageId = await this.whatsapp.sendImageMessage(dto.channelId, contact.phone, dto.imageUrl, dto.caption);
    return { waMessageId };
  }

  async saveAsTemplate(companyId: string, dto: { name: string; imageUrl: string; bodyText: string; language?: string }) {
    return this.templates.create(companyId, {
      name: dto.name,
      language: dto.language || 'en_US',
      category: 'MARKETING',
      components: [
        { type: 'HEADER', format: 'IMAGE', example: { header_handle: [dto.imageUrl] } },
        { type: 'BODY', text: dto.bodyText },
      ],
    });
  }
}
