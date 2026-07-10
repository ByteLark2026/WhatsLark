import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class FormsService {
  constructor(private readonly supabase: SupabaseService) {}

  private db() { return this.supabase.getAdminClient(); }

  async listForms(companyId: string) {
    const { data, error } = await this.db()
      .from('forms')
      .select('id, title, slug, is_active, submit_count, created_at, fields')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getForm(companyId: string, id: string) {
    const { data, error } = await this.db()
      .from('forms')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !data) throw new NotFoundException('Form not found');
    return data;
  }

  async createForm(companyId: string, userId: string, dto: {
    title: string;
    description?: string;
    slug?: string;
    fields?: any[];
    settings?: any;
  }) {
    const slug = dto.slug || this.slugify(dto.title) + '-' + Date.now().toString(36);
    const { data, error } = await this.db()
      .from('forms')
      .insert({
        company_id: companyId,
        created_by: userId,
        title: dto.title,
        description: dto.description || null,
        slug,
        fields: dto.fields || [],
        settings: dto.settings || { submit_button_text: 'Submit', success_message: 'Thank you! We will be in touch soon.' },
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateForm(companyId: string, id: string, dto: Partial<{
    title: string; description: string; slug: string;
    fields: any[]; settings: any; is_active: boolean;
  }>) {
    const { data, error } = await this.db()
      .from('forms')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteForm(companyId: string, id: string) {
    const { error } = await this.db()
      .from('forms')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  async getSubmissions(companyId: string, formId: string, opts: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = opts;
    const { data, error, count } = await this.db()
      .from('form_submissions')
      .select('id, data, contact_id, lead_id, ip_address, submitted_at', { count: 'exact' })
      .eq('form_id', formId)
      .eq('company_id', companyId)
      .order('submitted_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  // Public submit — no auth, identified by slug
  async submitForm(slug: string, data: Record<string, any>, ip?: string) {
    // Load form by slug
    const { data: form, error: formErr } = await this.db()
      .from('forms')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (formErr || !form) throw new NotFoundException('Form not found or inactive');

    const companyId = form.company_id;

    // Extract phone + name + email from submitted data
    const phone = this.extractField(data, ['phone', 'mobile', 'whatsapp']);
    const name = this.extractField(data, ['name', 'full_name', 'fullname', 'your_name']);
    const email = this.extractField(data, ['email', 'email_address']);

    let contactId: string | null = null;
    let leadId: string | null = null;

    // Upsert contact if phone provided
    if (phone) {
      const normalized = phone.replace(/\D/g, '');
      const { data: contact } = await this.db()
        .from('contacts')
        .upsert({
          company_id: companyId,
          phone: normalized,
          name: name || normalized,
          email: email || null,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'company_id,phone' })
        .select('id')
        .single();
      contactId = contact?.id || null;

      // Create lead
      if (contactId) {
        const { data: lead } = await this.db()
          .from('leads')
          .insert({
            company_id: companyId,
            contact_id: contactId,
            title: name || phone,
            source: 'form',
            status: 'new',
            notes: `Form: ${form.title}\n${Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n')}`,
          })
          .select('id')
          .single();
        leadId = lead?.id || null;
      }
    }

    // Insert submission
    const { data: submission } = await this.db()
      .from('form_submissions')
      .insert({
        form_id: form.id,
        company_id: companyId,
        data,
        contact_id: contactId,
        lead_id: leadId,
        ip_address: ip || null,
      })
      .select('id')
      .single();

    // Increment submit_count
    await this.db()
      .from('forms')
      .update({ submit_count: (form.submit_count || 0) + 1 })
      .eq('id', form.id);

    // Send WhatsApp if configured and phone exists
    const settings = form.settings || {};
    if (settings.send_whatsapp && settings.whatsapp_message && phone) {
      const channel = await this.db()
        .from('whatsapp_channels')
        .select('id, access_token, phone_number_id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (channel.data?.access_token) {
        const msg = settings.whatsapp_message
          .replace('{{name}}', name || 'there')
          .replace('{{form_title}}', form.title);
        const normalized = phone.replace(/[^0-9]/g, '');
        const GRAPH_V = process.env.WHATSAPP_API_VERSION || 'v21.0';
        fetch(`https://graph.facebook.com/${GRAPH_V}/${channel.data.phone_number_id}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${channel.data.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: normalized, type: 'text', text: { body: msg } }),
        }).catch((e) => console.error('[forms] WhatsApp send error:', e));
      }
    }

    return {
      ok: true,
      success_message: settings.success_message || 'Thank you! We will be in touch soon.',
      redirect_url: settings.redirect_url || null,
    };
  }

  // Public form data (no auth) — returns form fields only, no sensitive settings
  async getPublicForm(slug: string) {
    const { data, error } = await this.db()
      .from('forms')
      .select('id, title, description, fields, settings')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Form not found');
    return data;
  }

  private extractField(data: Record<string, any>, keys: string[]): string | null {
    for (const key of keys) {
      const val = data[key] || data[key.replace('_', '')] || data[key.replace('_', '-')];
      if (val && typeof val === 'string' && val.trim()) return val.trim();
    }
    return null;
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
