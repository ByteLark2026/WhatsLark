'use client';

import { useEffect, useState } from 'react';
import { Plus, FileText, ExternalLink, Copy, BarChart2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Form {
  id: string;
  title: string;
  slug: string;
  is_active: boolean;
  submit_count: number;
  created_at: string;
  fields: any[];
}

export default function FormsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await api.get<Form[]>('/forms');
      setForms(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createForm = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const form = await api.post<Form>('/forms', { title: title.trim() });
      setCreateOpen(false);
      setTitle('');
      router.push(`/forms/${form.id}`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  const toggleActive = async (form: Form) => {
    try {
      await api.patch(`/forms/${form.id}`, { is_active: !form.is_active });
      setForms((prev) => prev.map((f) => f.id === form.id ? { ...f, is_active: !f.is_active } : f));
    } catch {}
  };

  const deleteForm = async (form: Form) => {
    if (!confirm(`Delete "${form.title}"?`)) return;
    try {
      await api.delete(`/forms/${form.id}`);
      setForms((prev) => prev.filter((f) => f.id !== form.id));
      toast({ title: 'Form deleted' });
    } catch {}
  };

  const copyEmbedCode = (form: Form) => {
    const url = `${window.location.origin}/f/${form.slug}`;
    const code = `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(code);
    toast({ title: 'Embed code copied' });
  };

  const publicUrl = (slug: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${slug}`;

  return (
    <div>
      <Header
        title="Forms"
        subtitle="Lead capture forms — embed on your website or share as a link"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />New Form
          </Button>
        }
      />
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : forms.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm mb-4">No forms yet</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>Create first form</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{form.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{form.fields?.length || 0} fields · {form.submit_count} submissions</p>
                    </div>
                    <Badge variant={form.is_active ? 'success' : 'secondary'} className="shrink-0">
                      {form.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push(`/forms/${form.id}`)}>
                      <FileText className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push(`/forms/${form.id}/submissions`)}>
                      <BarChart2 className="w-3 h-3 mr-1" />{form.submit_count}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyEmbedCode(form)}>
                      <Copy className="w-3 h-3 mr-1" />Embed
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                      <a href={publicUrl(form.slug)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" />View
                      </a>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <p className="text-[10px] text-muted-foreground">{formatDate(form.created_at)}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleActive(form)} title={form.is_active ? 'Deactivate' : 'Activate'}>
                        {form.is_active ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteForm(form)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Form</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Form title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Contact Us" onKeyDown={(e) => e.key === 'Enter' && createForm()} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createForm} disabled={creating || !title.trim()}>{creating ? 'Creating…' : 'Create & Edit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
