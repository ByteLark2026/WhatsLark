'use client';

import { useEffect, useState } from 'react';
import { Plus, FileText, CheckCircle, Clock, XCircle, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { TemplateStatus } from '@whatslark/shared';
import type { MessageTemplate, TemplateComponent } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';
import { TemplateEditorDialog } from '@/components/templates/template-editor-dialog';
import { useChannelStore } from '@/store/channel';

const statusIcon = {
  pending: <Clock className="w-3.5 h-3.5 text-yellow-600" />,
  approved: <CheckCircle className="w-3.5 h-3.5 text-black" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-red-600" />,
};

const statusVariant: Record<TemplateStatus, any> = {
  pending: 'warning',
  approved: 'mono',
  rejected: 'destructive',
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<MessageTemplate | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<MessageTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const channels = useChannelStore((s) => s.channels);
  const channelNameById = Object.fromEntries(channels.map((c) => [c.id, `${c.name} · ${c.phone_number}`]));

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
    setEditTarget(tpl);
  };

  const closeEdit = () => setEditTarget(null);

  // Submits a just-created/edited row to Meta right away — a template sitting in our DB
  // with status='pending' but no wa_template_id was never actually sent to Meta, so it
  // would stay "pending" forever with no approval ever arriving. Reuses the same
  // /api/templates/submit path as the manual "Submit for review" action.
  const submitToMeta = async (templateId: string): Promise<MessageTemplate | null> => {
    if (!company?.id) return null;
    try {
      const res = await fetch('/api/templates/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, company_id: company.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Meta submission failed', description: data.message, variant: 'destructive' });
        return null;
      }
      toast({ title: 'Template submitted to Meta for review' });
      return data as unknown as MessageTemplate;
    } catch (err: any) {
      toast({ title: 'Meta submission failed', description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const handleAdd = async (data: { name: string; channel_id: string; language: string; category: string; components: TemplateComponent[] }) => {
    if (!company?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { data: created, error } = await supabase
      .from('message_templates')
      .insert({
        company_id: company.id,
        channel_id: data.channel_id,
        name: data.name,
        language: data.language,
        category: data.category,
        components: data.components,
        status: 'pending',
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    setTemplates((prev) => [created as unknown as MessageTemplate, ...prev]);
    setShowAdd(false);
    setDuplicateSource(null);
    setSaving(false);

    const submitted = await submitToMeta(created.id);
    if (submitted) setTemplates((prev) => prev.map((t) => t.id === submitted.id ? submitted : t));
  };

  const handleEdit = async (data: { name: string; channel_id: string; language: string; category: string; components: TemplateComponent[] }) => {
    if (!editTarget) return;
    setSaving(true);
    const supabase = createClient();
    const { data: updated, error } = await supabase
      .from('message_templates')
      .update({
        name: data.name,
        channel_id: data.channel_id,
        language: data.language,
        category: data.category,
        components: data.components,
        status: 'pending' as TemplateStatus,
      })
      .eq('id', editTarget.id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    setTemplates((prev) => prev.map((t) => t.id === editTarget.id ? updated as unknown as MessageTemplate : t));
    closeEdit();
    setSaving(false);

    const submitted = await submitToMeta(updated.id);
    if (submitted) setTemplates((prev) => prev.map((t) => t.id === submitted.id ? submitted : t));
  };

  // "Duplicate for another channel" — same name and content are fine across channels
  // (Meta only requires uniqueness per WABA), you just need to pick a different one.
  // Reuses the normal create dialog/handleAdd path, pre-filled from the source template.
  const openDuplicate = (tpl: MessageTemplate) => {
    setDuplicateSource({ ...tpl, channel_id: null });
    setShowAdd(true);
  };

  const handleSubmitForReview = async (tpl: MessageTemplate) => {
    if (!company?.id) return;
    setSubmittingId(tpl.id);
    try {
      const res = await fetch('/api/templates/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: tpl.id, company_id: company.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Submission failed', description: data.message, variant: 'destructive' });
      } else {
        setTemplates((prev) => prev.map((t) => t.id === tpl.id ? data as unknown as MessageTemplate : t));
        toast({ title: 'Template submitted to Meta for review' });
      }
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmittingId(null);
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
        actions={<Button size="sm" onClick={() => { setDuplicateSource(null); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />New template</Button>}
      />

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">No templates yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create WhatsApp message templates for campaigns.</p>
            <Button onClick={() => { setDuplicateSource(null); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />New template</Button>
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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tpl.channel_id ? (channelNameById[tpl.channel_id] || 'Unknown channel') : <span className="text-amber-600">No channel assigned</span>}
                      </p>
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
                          {tpl.status === 'pending' && (
                            <DropdownMenuItem disabled={submittingId === tpl.id} onClick={() => handleSubmitForReview(tpl)}>
                              {submittingId === tpl.id ? 'Submitting…' : 'Submit for review'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEdit(tpl)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDuplicate(tpl)}>Duplicate for another channel</DropdownMenuItem>
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

      <TemplateEditorDialog
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) closeEdit(); }}
        mode="edit"
        initial={editTarget}
        saving={saving}
        onSave={handleEdit}
      />

      <TemplateEditorDialog
        open={showAdd}
        onOpenChange={(open) => { setShowAdd(open); if (!open) setDuplicateSource(null); }}
        mode="create"
        initial={duplicateSource}
        saving={saving}
        onSave={handleAdd}
      />
    </div>
  );
}
