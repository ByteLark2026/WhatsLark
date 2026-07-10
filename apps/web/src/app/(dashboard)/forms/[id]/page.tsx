'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus, Trash2, GripVertical, Eye, Save, ArrowLeft, Copy, ExternalLink,
  Type, Mail, Phone, AlignLeft, ChevronDown, CheckSquare, Hash, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Field {
  id: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'number' | 'date';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface FormData {
  id: string;
  title: string;
  description: string;
  slug: string;
  fields: Field[];
  settings: {
    submit_button_text: string;
    success_message: string;
    redirect_url: string;
    send_whatsapp: boolean;
    whatsapp_message: string;
  };
  is_active: boolean;
}

const FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'textarea', label: 'Long text', icon: AlignLeft },
  { type: 'select', label: 'Dropdown', icon: ChevronDown },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'date', label: 'Date', icon: Calendar },
] as const;

const fieldIcon: Record<string, any> = {
  text: Type, email: Mail, phone: Phone, textarea: AlignLeft,
  select: ChevronDown, checkbox: CheckSquare, number: Hash, date: Calendar,
};

function uid() { return Math.random().toString(36).slice(2); }

export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);

  useEffect(() => {
    api.get<FormData>(`/forms/${id}`).then((data) => { setForm(data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.patch(`/forms/${id}`, {
        title: form.title,
        description: form.description,
        slug: form.slug,
        fields: form.fields,
        settings: form.settings,
        is_active: form.is_active,
      });
      toast({ title: 'Saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const addField = (type: Field['type']) => {
    if (!form) return;
    const field: Field = {
      id: uid(), type, label: FIELD_TYPES.find((f) => f.type === type)?.label || type,
      placeholder: '', required: false,
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setForm((f) => f ? { ...f, fields: [...f.fields, field] } : f);
    setSelectedField(field.id);
  };

  const updateField = (fieldId: string, updates: Partial<Field>) => {
    setForm((f) => f ? { ...f, fields: f.fields.map((fi) => fi.id === fieldId ? { ...fi, ...updates } : fi) } : f);
  };

  const removeField = (fieldId: string) => {
    setForm((f) => f ? { ...f, fields: f.fields.filter((fi) => fi.id !== fieldId) } : f);
    if (selectedField === fieldId) setSelectedField(null);
  };

  const moveField = (index: number, dir: 1 | -1) => {
    if (!form) return;
    const fields = [...form.fields];
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    [fields[index], fields[newIdx]] = [fields[newIdx], fields[index]];
    setForm((f) => f ? { ...f, fields } : f);
  };

  const publicUrl = form ? `${window.location.origin}/f/${form.slug}` : '';

  const selected = form?.fields.find((f) => f.id === selectedField);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!form) return <div className="p-8 text-center text-muted-foreground">Form not found</div>;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={form.title}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1.5" />Preview</a>
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-4 sm:p-6">
        <Tabs defaultValue="builder">
          <TabsList className="mb-4">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
          </TabsList>

          {/* ── Builder ── */}
          <TabsContent value="builder">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Field palette */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add field</p>
                <div className="grid grid-cols-2 gap-2">
                  {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                    <button key={type} onClick={() => addField(type as Field['type'])}
                      className="flex items-center gap-2 p-2.5 border rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors text-left">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />{label}
                    </button>
                  ))}
                </div>

                {/* Field editor */}
                {selected && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Edit field</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Label</Label>
                        <Input value={selected.label} onChange={(e) => updateField(selected.id, { label: e.target.value })} className="h-8 text-sm" />
                      </div>
                      {selected.type !== 'checkbox' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Placeholder</Label>
                          <Input value={selected.placeholder || ''} onChange={(e) => updateField(selected.id, { placeholder: e.target.value })} className="h-8 text-sm" />
                        </div>
                      )}
                      {selected.type === 'select' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Options (one per line)</Label>
                          <Textarea
                            value={(selected.options || []).join('\n')}
                            onChange={(e) => updateField(selected.id, { options: e.target.value.split('\n').filter(Boolean) })}
                            className="text-sm h-20"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Required</Label>
                        <Switch checked={selected.required} onCheckedChange={(v) => updateField(selected.id, { required: v })} />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Form preview */}
              <div className="lg:col-span-2">
                <Card>
                  <CardContent className="p-6">
                    <div className="mb-4">
                      <input
                        className="text-xl font-bold bg-transparent border-0 border-b border-dashed border-muted-foreground/30 w-full focus:outline-none focus:border-primary pb-1"
                        value={form.title}
                        onChange={(e) => setForm((f) => f ? { ...f, title: e.target.value } : f)}
                        placeholder="Form title"
                      />
                      <input
                        className="text-sm text-muted-foreground bg-transparent border-0 w-full focus:outline-none mt-1"
                        value={form.description || ''}
                        onChange={(e) => setForm((f) => f ? { ...f, description: e.target.value } : f)}
                        placeholder="Form description (optional)"
                      />
                    </div>

                    {form.fields.length === 0 ? (
                      <div className="border-2 border-dashed rounded-lg py-12 text-center text-muted-foreground text-sm">
                        Add fields from the left panel
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {form.fields.map((field, idx) => {
                          const Icon = fieldIcon[field.type] || Type;
                          const isSelected = selectedField === field.id;
                          return (
                            <div key={field.id}
                              onClick={() => setSelectedField(field.id)}
                              className={cn('border rounded-lg p-3 cursor-pointer transition-colors', isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40')}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm font-medium">{field.label}</span>
                                  {field.required && <Badge variant="destructive" className="text-[10px] px-1 py-0">Required</Badge>}
                                </div>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(idx, -1)} disabled={idx === 0}>↑</Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(idx, 1)} disabled={idx === form.fields.length - 1}>↓</Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeField(field.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              {/* Preview input */}
                              {field.type === 'textarea' ? (
                                <div className="h-10 bg-muted/50 rounded border text-xs text-muted-foreground flex items-start p-2">{field.placeholder || 'Long text…'}</div>
                              ) : field.type === 'select' ? (
                                <div className="h-8 bg-muted/50 rounded border text-xs text-muted-foreground flex items-center px-2 justify-between">
                                  <span>{field.placeholder || 'Select…'}</span><ChevronDown className="w-3 h-3" />
                                </div>
                              ) : field.type === 'checkbox' ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <div className="w-4 h-4 border rounded" />{field.label}
                                </div>
                              ) : (
                                <div className="h-8 bg-muted/50 rounded border text-xs text-muted-foreground flex items-center px-2">{field.placeholder || field.label}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <Button className="mt-4 w-full" disabled>
                      {form.settings.submit_button_text || 'Submit'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── Settings ── */}
          <TabsContent value="settings">
            <div className="max-w-lg space-y-5">
              <div className="space-y-1.5">
                <Label>Form slug (URL)</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => f ? { ...f, slug: e.target.value } : f)} />
                <p className="text-xs text-muted-foreground">Public URL: /f/{form.slug}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Submit button text</Label>
                <Input value={form.settings.submit_button_text || ''} onChange={(e) => setForm((f) => f ? { ...f, settings: { ...f.settings, submit_button_text: e.target.value } } : f)} />
              </div>
              <div className="space-y-1.5">
                <Label>Success message</Label>
                <Textarea value={form.settings.success_message || ''} onChange={(e) => setForm((f) => f ? { ...f, settings: { ...f.settings, success_message: e.target.value } } : f)} className="h-20" />
              </div>
              <div className="space-y-1.5">
                <Label>Redirect URL after submit (optional)</Label>
                <Input value={form.settings.redirect_url || ''} onChange={(e) => setForm((f) => f ? { ...f, settings: { ...f.settings, redirect_url: e.target.value } } : f)} placeholder="https://yoursite.com/thank-you" />
              </div>
              <div className="flex items-center justify-between py-2 border-t">
                <div>
                  <p className="text-sm font-medium">Send WhatsApp on submit</p>
                  <p className="text-xs text-muted-foreground">Requires phone field in form</p>
                </div>
                <Switch checked={!!form.settings.send_whatsapp} onCheckedChange={(v) => setForm((f) => f ? { ...f, settings: { ...f.settings, send_whatsapp: v } } : f)} />
              </div>
              {form.settings.send_whatsapp && (
                <div className="space-y-1.5">
                  <Label>WhatsApp message</Label>
                  <Textarea
                    value={form.settings.whatsapp_message || ''}
                    onChange={(e) => setForm((f) => f ? { ...f, settings: { ...f.settings, whatsapp_message: e.target.value } } : f)}
                    placeholder="Hi {{name}}, thanks for contacting us! We'll get back to you shortly."
                    className="h-24"
                  />
                  <p className="text-xs text-muted-foreground">Variables: {'{{name}}'}, {'{{form_title}}'}</p>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-t">
                <p className="text-sm font-medium">Form active</p>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => f ? { ...f, is_active: v } : f)} />
              </div>
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
            </div>
          </TabsContent>

          {/* ── Embed ── */}
          <TabsContent value="embed">
            <div className="max-w-xl space-y-6">
              <div className="space-y-2">
                <Label>Direct link</Label>
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: 'Copied' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>iFrame embed</Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    value={`<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`}
                    className="font-mono text-xs h-24"
                  />
                  <Button variant="outline" size="sm" className="absolute top-2 right-2 h-6 text-xs"
                    onClick={() => { navigator.clipboard.writeText(`<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`); toast({ title: 'Copied' }); }}>
                    Copy
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Script embed (inline)</Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    value={`<div id="wl-form-${form.id}"></div>\n<script src="${window.location.origin}/form-embed.js" data-form="${form.slug}" data-target="wl-form-${form.id}"></script>`}
                    className="font-mono text-xs h-28"
                  />
                  <Button variant="outline" size="sm" className="absolute top-2 right-2 h-6 text-xs"
                    onClick={() => { navigator.clipboard.writeText(`<div id="wl-form-${form.id}"></div>\n<script src="${window.location.origin}/form-embed.js" data-form="${form.slug}" data-target="wl-form-${form.id}"></script>`); toast({ title: 'Copied' }); }}>
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
