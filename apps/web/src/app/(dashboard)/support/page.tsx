'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { AdminPagination } from '@/components/admin/pagination';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { SupportTicketStatus, SupportTicketPriority } from '@whatslark/shared';
import type { SupportTicket, SupportTicketReply } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

type TicketWithReplies = SupportTicket & {
  support_ticket_replies?: (SupportTicketReply & { author?: { full_name: string; email: string } })[];
};

const statusVariant: Record<string, any> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'outline',
};

const priorityVariant: Record<string, any> = {
  low: 'outline',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
};

const emptyForm = { subject: '', description: '', priority: SupportTicketPriority.MEDIUM as string };

export default function SupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<TicketWithReplies | null>(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<{ data: SupportTicket[]; total: number }>(`/support-tickets?page=${page}&limit=${limit}`)
      .then((res) => { setTickets(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const createTicket = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ title: 'Subject and description are required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await api.post('/support-tickets', form);
      toast({ title: 'Ticket created' });
      setNewOpen(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const openTicket = async (id: string) => {
    try {
      const data = await api.get<TicketWithReplies>(`/support-tickets/${id}`);
      setSelected(data);
      setReply('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const submitReply = async () => {
    if (!selected || !reply.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/support-tickets/${selected.id}/replies`, { message: reply });
      const data = await api.get<TicketWithReplies>(`/support-tickets/${selected.id}`);
      setSelected(data);
      setReply('');
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        title="Support"
        subtitle={`${total.toLocaleString()} tickets`}
        actions={
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" />New Ticket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Support Ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Subject</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(SupportTicketPriority).map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createTicket} disabled={creating}>{creating ? 'Creating…' : 'Create Ticket'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="rounded-lg border overflow-x-auto bg-background">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(4)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No support tickets yet.</td></tr>
              ) : tickets.map((t) => (
                <tr key={t.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => openTicket(t.id)}>
                  <td className="px-4 py-3 font-medium">{t.subject}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant[t.status] || 'outline'} className="capitalize">{t.status.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={priorityVariant[t.priority] || 'outline'} className="capitalize">{t.priority}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[selected.status] || 'outline'} className="capitalize">{selected.status.replace('_', ' ')}</Badge>
                  <Badge variant={priorityVariant[selected.priority] || 'outline'} className="capitalize">{selected.priority}</Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>

                <div className="border rounded-lg divide-y">
                  {(selected.support_ticket_replies || []).length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No replies yet.</p>
                  ) : selected.support_ticket_replies!.map((r) => (
                    <div key={r.id} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">{r.author?.full_name ?? 'Support team'}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{r.message}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <Label>Reply</Label>
                  <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex items-center justify-end mt-2">
                    <Button onClick={submitReply} disabled={submitting || !reply.trim()}>{submitting ? 'Sending…' : 'Send Reply'}</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
