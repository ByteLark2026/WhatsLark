'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';

interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
  created_at: string;
}

export default function QuickRepliesPage() {
  const { company, user } = useAuthStore();
  const { toast } = useToast();
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [saving, setSaving] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!company?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('quick_replies')
      .select('*')
      .eq('company_id', company.id)
      .order('shortcut');
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [company?.id]);

  const openCreate = () => { setEditing(null); setShortcut(''); setMessage(''); setDialogOpen(true); };
  const openEdit = (r: QuickReply) => { setEditing(r); setShortcut(r.shortcut); setMessage(r.message); setDialogOpen(true); };

  const save = async () => {
    if (!shortcut.trim() || !message.trim() || !company?.id) return;
    setSaving(true);
    const supabase = createClient();
    const slug = shortcut.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (editing) {
      const { error } = await supabase.from('quick_replies').update({ shortcut: slug, message: message.trim() }).eq('id', editing.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Updated' }); setDialogOpen(false); await load(); }
    } else {
      const { error } = await supabase.from('quick_replies').insert({ company_id: company.id, shortcut: slug, message: message.trim(), created_by: user?.id });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Created' }); setDialogOpen(false); await load(); }
    }
    setSaving(false);
  };

  const del = async (r: QuickReply) => {
    if (!confirm(`Delete /${r.shortcut}?`)) return;
    const supabase = createClient();
    await supabase.from('quick_replies').delete().eq('id', r.id);
    setItems((prev) => prev.filter((i) => i.id !== r.id));
    toast({ title: 'Deleted' });
  };

  return (
    <div>
      <Header
        title="Quick Replies"
        subtitle="Saved message shortcuts — type / in inbox to insert"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />New Reply
          </Button>
        }
      />
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Zap className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm mb-4">No quick replies yet</p>
            <p className="text-xs max-w-xs mx-auto mb-4">Create shortcuts like <code className="bg-muted px-1 rounded">/thanks</code> that expand to full messages in the inbox</p>
            <Button size="sm" onClick={openCreate}>Create first quick reply</Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {items.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start gap-4">
                  <Badge variant="outline" className="font-mono text-xs shrink-0 mt-0.5">/{r.shortcut}</Badge>
                  <p className="text-sm text-muted-foreground flex-1 line-clamp-2">{r.message}</p>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => del(r)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Quick Reply' : 'New Quick Reply'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Shortcut *</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">/</span>
                <Input
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  placeholder="thanks"
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">Letters, numbers, underscores only</p>
            </div>
            <div className="space-y-1.5">
              <Label>Message *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Thank you for contacting us! How can I help you today?"
                className="h-28"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !shortcut.trim() || !message.trim()}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
