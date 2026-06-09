'use client';

import { useEffect, useState } from 'react';
import { Plus, FileText, CheckCircle, Clock, XCircle, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { TemplateStatus } from '@whatslark/shared';
import type { MessageTemplate } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

const statusIcon = {
  pending: <Clock className="w-3.5 h-3.5 text-yellow-600" />,
  approved: <CheckCircle className="w-3.5 h-3.5 text-green-600" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-red-600" />,
};

const statusVariant: Record<TemplateStatus, any> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

const BLANK_FORM = { name: '', language: 'en', category: 'MARKETING', body: '' };

export default function TemplatesPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (!error && data) setTemplates(data as unknown as MessageTemplate[]);
      setLoading(false);
    })();
  }, [company?.id]);

  const openEdit = (tpl: MessageTemplate) => {
    const body = tpl.components.find((c) => c.type === 'BODY')?.text || '';
    setForm({ name: tpl.name, language: tpl.language, category: tpl.category, body });
    setEditTarget(tpl);
  };

  const closeEdit = () => { setEditTarget(null); setForm(BLANK_FORM); };

  const handleAdd = async () => {
    if (!company?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        company_id: company.id,
        name: form.name,
        language: form.language,
        category: form.category,
        components: [{ type: 'BODY', text: form.body }],
        status: 'pending',
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTemplates((prev) => [data as unknown as MessageTemplate, ...prev]);
      setShowAdd(false);
      setForm(BLANK_FORM);
      toast({ title: 'Template created — pending approval' });
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const supabase = createClient();
    const updated = {
      name: form.name,
      language: form.language,
      category: form.category,
      components: editTarget.components.map((c) =>
        c.type === 'BODY' ? { ...c, text: form.body } : c
      ),
      status: 'pending' as TemplateStatus,
    };
    const { data, error } = await supabase
      .from('message_templates')
      .update(updated)
      .eq('id', editTarget.id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTemplates((prev) => prev.map((t) => t.id === editTarget.id ? data as unknown as MessageTemplate : t));
      closeEdit();
      toast({ title: 'Template updated — pending re-approval' });
    }
    setSaving(false);
  };

  const handleDuplicate = async (tpl: MessageTemplate) => {
    if (!company?.id) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        company_id: company.id,
        name: tpl.name + '_copy',
        language: tpl.language,
        category: tpl.category,
        components: tpl.components,
        status: 'pending',
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTemplates((prev) => [data as unknown as MessageTemplate, ...prev]);
      toast({ title: 'Template duplicated' });
    }
  };

  const handleDelete = async (tpl: MessageTemplate) => {
    if (!confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('message_templates').delete().eq('id', tpl.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      toast({ title: 'Template deleted' });
    }
  };

  return (
    <div>
      <Header
        title="Message Templates"
        subtitle="WhatsApp approved templates for campaigns"
        actions={<Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />New template</Button>}
      />

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">No templates yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create WhatsApp message templates for campaigns.</p>
            <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />New template</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((tpl) => {
              const body = tpl.components.find((c) => c.type === 'BODY');
              return (
                <Card key={tpl.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 flex-row items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tpl.category} · {tpl.language.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {statusIcon[tpl.status]}
                      <Badge variant={statusVariant[tpl.status]} className="text-xs capitalize">{tpl.status}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(tpl)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(tpl)}>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(tpl)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground line-clamp-3">{body?.text || 'No body content'}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template name *</Label>
              <Input placeholder="order_confirmation" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s/g, '_') })} />
              <p className="text-xs text-muted-foreground">Lowercase, underscores only</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['en', 'ms', 'id', 'th', 'ar', 'es', 'pt', 'fr', 'de', 'zh'].map((l) => (
                      <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['MARKETING', 'UTILITY', 'AUTHENTICATION'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body text *</Label>
              <Textarea
                rows={4}
                placeholder="Hello {{1}}, your order {{2}} has been confirmed!"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for variables</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !form.name || !form.body}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template name *</Label>
              <Input placeholder="order_confirmation" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s/g, '_') })} />
              <p className="text-xs text-muted-foreground">Lowercase, underscores only</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['en', 'ms', 'id', 'th', 'ar', 'es', 'pt', 'fr', 'de', 'zh'].map((l) => (
                      <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['MARKETING', 'UTILITY', 'AUTHENTICATION'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body text *</Label>
              <Textarea
                rows={4}
                placeholder="Hello {{1}}, your order {{2}} has been confirmed!"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for variables</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !form.name || !form.body}>Create template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
