'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Send, Package, Eye, Hash, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { ProductPicker, type PickedProduct } from '@/components/ecommerce/ProductPicker';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MessageTemplate, WhatsAppChannel } from '@whatslark/shared';

// Parse variables from template component text: {{1}}, {{2}} etc → returns count
function parseVars(text: string): number[] {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  return matches.map((m) => parseInt(m[1]));
}

function templateBodyText(components: any[]): string {
  return components?.find((c: any) => c.type === 'BODY')?.text || '';
}
function templateHeaderText(components: any[]): string {
  const h = components?.find((c: any) => c.type === 'HEADER');
  if (h?.format === 'TEXT') return h.text || '';
  return '';
}
function templateButtons(components: any[]): any[] {
  return components?.find((c: any) => c.type === 'BUTTONS')?.buttons || [];
}
function templateFooterText(components: any[]): string {
  return components?.find((c: any) => c.type === 'FOOTER')?.text || '';
}

function previewText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const val = vars[`body_${n}`] || vars[`header_${n}`] || `{{${n}}}`;
    return val || `{{${n}}}`;
  });
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { company, user } = useAuthStore();

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PickedProduct | null>(null);

  const [form, setForm] = useState({
    name: '',
    template_id: '',
    channel_id: '',
    scheduled_at: '',
  });

  // Per-variable values: { body_1: '', body_2: '', header_1: '', button_0: '' }
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!company?.id) { setLoadingData(false); return; }
    const supabase = createClient();
    Promise.all([
      supabase.from('message_templates').select('id, name, category, language, status, components').eq('company_id', company.id).eq('status', 'approved').order('name'),
      supabase.from('whatsapp_channels').select('id, name, phone_number').eq('company_id', company.id).eq('is_active', true),
    ]).then(([tplRes, chRes]) => {
      if (tplRes.data) setTemplates(tplRes.data as unknown as MessageTemplate[]);
      if (chRes.data) setChannels(chRes.data as unknown as WhatsAppChannel[]);
    }).finally(() => setLoadingData(false));
  }, [company?.id]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === form.template_id) || null,
    [templates, form.template_id],
  );

  const bodyText = selectedTemplate ? templateBodyText((selectedTemplate as any).components || []) : '';
  const headerText = selectedTemplate ? templateHeaderText((selectedTemplate as any).components || []) : '';
  const footerText = selectedTemplate ? templateFooterText((selectedTemplate as any).components || []) : '';
  const buttons = selectedTemplate ? templateButtons((selectedTemplate as any).components || []) : [];

  const bodyVarCount = bodyText ? parseVars(bodyText).length : 0;
  const headerVarCount = headerText ? parseVars(headerText).length : 0;
  const urlButtons = buttons.filter((b: any) => b.type === 'URL' && /\{\{/.test(b.url || ''));

  // Reset variables when template changes
  useEffect(() => { setTemplateVars({}); setSelectedProduct(null); }, [form.template_id]);

  const setVar = (key: string, val: string) => setTemplateVars((v) => ({ ...v, [key]: val }));

  const insertProduct = (product: PickedProduct) => {
    setSelectedProduct(product);
    // Auto-fill: name → body_1/header_1, price → body_2, URL → body_3 or button_0
    const updates: Record<string, string> = {};
    if (headerVarCount >= 1) updates['header_1'] = product.name;
    if (bodyVarCount >= 1 && !updates['header_1']) updates['body_1'] = product.name;
    else if (bodyVarCount >= 1) updates['body_1'] = product.name;
    if (bodyVarCount >= 2) updates['body_2'] = product.price != null ? String(product.price) : '';
    if (bodyVarCount >= 3) updates['body_3'] = product.product_url || '';
    if (urlButtons.length > 0 && product.product_url) updates['button_0'] = product.product_url;
    setTemplateVars((v) => ({ ...v, ...updates }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !user?.id) return;
    if (!form.name || !form.template_id || !form.channel_id) {
      toast({ title: 'Missing fields', description: 'Name, template and channel are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        company_id: company.id,
        name: form.name,
        template_id: form.template_id,
        channel_id: form.channel_id,
        scheduled_at: form.scheduled_at || null,
        status: 'draft',
        created_by: user.id,
        total_recipients: 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        replied_count: 0,
        template_variables: templateVars,
        ecommerce_product_id: selectedProduct?.id || null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Campaign created', description: `"${form.name}" saved as draft.` });
      router.push('/campaigns');
    }
    setSaving(false);
  };

  const hasVars = bodyVarCount > 0 || headerVarCount > 0 || urlButtons.length > 0;

  return (
    <div>
      <Header
        title="New Campaign"
        subtitle="Broadcast a WhatsApp message to your contacts"
        actions={
          <Link href="/campaigns">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
          </Link>
        }
      />

      <div className="p-4 sm:p-6 max-w-3xl">
        {loadingData ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campaign details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign details</CardTitle>
                <CardDescription>Name and optional schedule.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign name *</Label>
                  <Input id="name" placeholder="e.g. June Promo Blast"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Schedule (optional)</Label>
                  <Input type="datetime-local" value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Leave blank to save as draft and schedule later.</p>
                </div>
              </CardContent>
            </Card>

            {/* Channel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">WhatsApp channel *</CardTitle>
              </CardHeader>
              <CardContent>
                {channels.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No active channels. <Link href="/channels" className="text-primary hover:underline">Connect one first.</Link>
                  </div>
                ) : (
                  <Select value={form.channel_id} onValueChange={(v) => setForm({ ...form, channel_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a channel…" /></SelectTrigger>
                    <SelectContent>
                      {channels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          {ch.name} <span className="text-muted-foreground ml-1">· {ch.phone_number}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* Template */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Message template *</CardTitle>
                <CardDescription>Only approved templates can be used.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No approved templates. <Link href="/templates" className="text-primary hover:underline">Create one first.</Link>
                  </div>
                ) : (
                  <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a template…" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} <span className="text-muted-foreground ml-1">· {t.category} · {t.language.toUpperCase()}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Template preview */}
                {selectedTemplate && (
                  <div className="rounded-xl bg-[#e5ddd5] p-3 relative">
                    <p className="text-[10px] text-gray-500 mb-2 flex items-center gap-1"><Eye className="w-3 h-3" />Preview</p>
                    <div className="bg-white rounded-lg px-3 py-2.5 shadow-sm text-sm max-w-[280px] space-y-1.5">
                      {headerText && (
                        <p className="font-semibold text-gray-800">
                          {previewText(headerText, { ...Object.fromEntries(Object.entries(templateVars).map(([k, v]) => [k.replace('body_', 'header_'), v])), ...templateVars })}
                        </p>
                      )}
                      {bodyText && (
                        <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-wrap">
                          {previewText(bodyText, templateVars)}
                        </p>
                      )}
                      {footerText && <p className="text-gray-400 text-[11px]">{footerText}</p>}
                      {buttons.length > 0 && (
                        <div className="border-t pt-1.5 space-y-1">
                          {buttons.map((btn: any, i: number) => (
                            <div key={i} className="text-center text-xs text-blue-600 py-0.5">
                              {btn.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">{(selectedTemplate as any).category}</Badge>
                      <Badge variant="outline" className="text-[10px]">{(selectedTemplate as any).language?.toUpperCase()}</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template variables */}
            {selectedTemplate && hasVars && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Hash className="w-4 h-4" />Template variables
                      </CardTitle>
                      <CardDescription>Fill in the variable values for this campaign.</CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setShowProductPicker(true)}
                      className="flex-shrink-0">
                      <Package className="w-3.5 h-3.5 mr-1.5" />
                      {selectedProduct ? 'Change product' : 'Insert product'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selected product preview */}
                  {selectedProduct && (
                    <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {selectedProduct.image_url
                          ? <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                          : <Package className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedProduct.name}</p>
                        {selectedProduct.price != null && <p className="text-xs text-muted-foreground">{selectedProduct.price}</p>}
                      </div>
                      <Sparkles className="w-4 h-4 text-green-600 flex-shrink-0" />
                    </div>
                  )}

                  {/* Header variables */}
                  {headerVarCount > 0 && Array.from({ length: headerVarCount }, (_, i) => (
                    <div key={`h${i}`} className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-mono">Header {'{{' + (i + 1) + '}}'}</Badge>
                      </Label>
                      <Input className="text-sm" placeholder={`Header variable ${i + 1}`}
                        value={templateVars[`header_${i + 1}`] || ''}
                        onChange={(e) => setVar(`header_${i + 1}`, e.target.value)} />
                    </div>
                  ))}

                  {/* Body variables */}
                  {bodyVarCount > 0 && Array.from({ length: bodyVarCount }, (_, i) => (
                    <div key={`b${i}`} className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-mono">Body {'{{' + (i + 1) + '}}'}</Badge>
                        <span className="text-muted-foreground">
                          {i === 0 ? '— usually product name or contact name' : i === 1 ? '— usually price or date' : i === 2 ? '— usually link or details' : ''}
                        </span>
                      </Label>
                      <Input className="text-sm" placeholder={`Variable ${i + 1} value`}
                        value={templateVars[`body_${i + 1}`] || ''}
                        onChange={(e) => setVar(`body_${i + 1}`, e.target.value)} />
                    </div>
                  ))}

                  {/* URL button variables */}
                  {urlButtons.map((btn: any, idx: number) => (
                    <div key={`btn${idx}`} className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-mono">Button "{btn.text}" URL suffix</Badge>
                      </Label>
                      <Input className="text-sm" placeholder="URL path or tracking ID"
                        value={templateVars[`button_${idx}`] || ''}
                        onChange={(e) => setVar(`button_${idx}`, e.target.value)} />
                      <p className="text-[10px] text-muted-foreground">
                        Base URL: {btn.url?.replace(/\{\{.*?\}\}/, '[suffix]')}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving || !form.name || !form.template_id || !form.channel_id}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Save as draft
              </Button>
              <Link href="/campaigns"><Button variant="outline" type="button">Cancel</Button></Link>
            </div>
          </form>
        )}
      </div>

      <ProductPicker
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={insertProduct}
        selectedId={selectedProduct?.id}
      />
    </div>
  );
}
