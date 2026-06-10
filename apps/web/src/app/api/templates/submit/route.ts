import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TemplateComponent, TemplateButton } from '@whatslark/shared';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GRAPH_VERSION = 'v19.0';

interface ChannelCreds {
  business_account_id: string;
  access_token: string;
  meta_app_id?: string | null;
}

// Resumable Upload API — required to attach sample media to a template header.
async function uploadMediaHandle(appId: string, accessToken: string, mediaUrl: string): Promise<string> {
  const fileRes = await fetch(mediaUrl);
  if (!fileRes.ok) throw new Error(`Could not download sample media (HTTP ${fileRes.status})`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

  const sessionRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/uploads?file_length=${buffer.length}&file_type=${encodeURIComponent(contentType)}&access_token=${encodeURIComponent(accessToken)}`,
    { method: 'POST' },
  );
  const sessionJson = await sessionRes.json();
  if (!sessionRes.ok) throw new Error(sessionJson.error?.message || 'Failed to start media upload session');

  const uploadRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${sessionJson.id}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: '0',
    },
    body: buffer,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(uploadJson.error?.message || 'Failed to upload sample media');
  return uploadJson.h;
}

function generateSamples(text?: string): string[] | undefined {
  if (!text) return undefined;
  const matches = [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)];
  if (!matches.length) return undefined;
  return matches.map((_m, i) => `Sample${i + 1}`);
}

function transformButton(b: TemplateButton): Record<string, any> {
  const out: Record<string, any> = { type: b.type, text: b.text };
  if (b.type === 'URL' && b.url) out.url = b.url;
  if (b.type === 'PHONE_NUMBER' && b.phone_number) out.phone_number = b.phone_number;
  if (b.type === 'COPY_CODE') out.example = b.example ? [b.example] : undefined;
  if (b.type === 'CATALOG' && b.catalog_id) out.catalog_id = b.catalog_id;
  if (b.type === 'MPM' && b.sections) out.sections = b.sections;
  if (b.type === 'SPM' && b.product_retailer_id) out.product_retailer_id = b.product_retailer_id;
  return out;
}

async function transformComponent(component: TemplateComponent, channel: ChannelCreds): Promise<Record<string, any>> {
  const out: Record<string, any> = { type: component.type };

  switch (component.type) {
    case 'HEADER': {
      const format = component.format || 'TEXT';
      out.format = format;
      if (format === 'TEXT') {
        out.text = component.text;
        const example = generateSamples(component.text);
        if (example) out.example = { header_text: example };
      } else if (format === 'LOCATION') {
        // No text/example required.
      } else if (component.text) {
        if (!channel.meta_app_id) {
          throw new Error('This template has an image/video/document header. Add a Meta App ID in Channels → Edit to upload the sample media for review.');
        }
        const handle = await uploadMediaHandle(channel.meta_app_id, channel.access_token, component.text);
        out.example = { header_handle: [handle] };
      }
      return out;
    }

    case 'BODY': {
      out.text = component.text;
      const example = generateSamples(component.text);
      if (example) out.example = { body_text: [example] };
      return out;
    }

    case 'FOOTER':
      out.text = component.text;
      return out;

    case 'BUTTONS':
      out.buttons = (component.buttons || []).map(transformButton);
      return out;

    case 'LIMITED_TIME_OFFER':
      out.limited_time_offer = component.limited_time_offer;
      return out;

    case 'CAROUSEL':
      out.cards = await Promise.all(
        (component.cards || []).map(async (card, index) => ({
          card_index: index,
          components: await Promise.all(card.components.map((c) => transformComponent(c, channel))),
        })),
      );
      return out;

    default:
      return out;
  }
}

function mapMetaStatus(status?: string): 'pending' | 'approved' | 'rejected' {
  switch ((status || '').toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return 'rejected';
    default:
      return 'pending';
  }
}

export async function POST(req: NextRequest) {
  try {
    const { template_id, company_id } = await req.json();
    if (!template_id || !company_id) {
      return NextResponse.json({ message: 'template_id and company_id are required' }, { status: 400 });
    }

    const { data: template, error: tplErr } = await adminSupabase
      .from('message_templates')
      .select('*')
      .eq('id', template_id)
      .eq('company_id', company_id)
      .single();
    if (tplErr || !template) return NextResponse.json({ message: 'Template not found' }, { status: 404 });

    const { data: channel, error: chErr } = await adminSupabase
      .from('whatsapp_channels')
      .select('business_account_id, access_token, meta_app_id')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (chErr || !channel) {
      return NextResponse.json({ message: 'No active WhatsApp channel connected. Connect one in Channels first.' }, { status: 400 });
    }

    const components = await Promise.all(
      ((template.components || []) as TemplateComponent[]).map((c) => transformComponent(c, channel as ChannelCreds)),
    );

    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${channel.business_account_id}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channel.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: template.name,
        language: template.language,
        category: template.category,
        components,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json({ message: json.error?.error_user_msg || json.error?.message || 'Meta rejected the template' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await adminSupabase
      .from('message_templates')
      .update({ wa_template_id: json.id, status: mapMetaStatus(json.status) })
      .eq('id', template_id)
      .select()
      .single();
    if (updateErr) return NextResponse.json({ message: updateErr.message }, { status: 500 });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[templates/submit]', err);
    return NextResponse.json({ message: err.message || 'Submission failed' }, { status: 500 });
  }
}
