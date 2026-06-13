'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { SupportTicketStatus, SupportTicketPriority } from '@whatslark/shared';
import type { SupportTicket, SupportTicketReply, Company } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';
import { useToast } from '@/hooks/use-toast';

type AdminTicket = SupportTicket & {
  companies?: { name: string; slug: string } | { name: string; slug: string }[];
  user?: { full_name: string; email: string } | { full_name: string; email: string }[];
  assignee?: { full_name: string; email: string } | { full_name: string; email: string }[];
  support_ticket_replies?: (SupportTicketReply & { author?: { full_name: string; email: string } | { full_name: string; email: string }[] })[];
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

function single<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const emptyNewTicket = {
  company_id: '',
  subject: '',
  description: '',
  priority: SupportTicketPriority.MEDIUM as string,
};

export default function AdminSupportTicketsPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminTicket | null>(null);
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newTicket, setNewTicket] = useState(emptyNewTicket);
  const [creating, setCreating] = useState(false);
  const limit = 20;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status !== 'all') params.set('status', status);
    api.get<{ data: AdminTicket[]; total: number }>(`/admin/support-tickets?${params.toString()}`)
      .then((res) => { setTickets(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, status]);

  useEffect(() => {
    api.get<{ data: Company[] }>('/admin/companies?limit=200')
      .then((res) => setCompanies(res.data))
      .catch(console.error);
  }, []);

  const createTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast({ title: 'Subject and description are required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/support-tickets', {
        ...newTicket,
        company_id: newTicket.company_id || undefined,
      });
      toast({ title: 'Ticket created' });
      setNewOpen(false);
      setNewTicket(emptyNewTicket);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const openTicket = async (id: string) => {
    try {
      const data = await api.get<AdminTicket>(`/admin/support-tickets/${id}`);
      setSelected(data);
      setReply('');
      setInternalNote(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const updateField = async (field: 'status' | 'priority', value: string) => {
    if (!selected) return;
    try {
      await api.patch(`/admin/support-tickets/${selected.id}`, { [field]: value });
      setSelected({ ...selected, [field]: value } as AdminTicket);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const submitReply = async () => {
    if (!selected || !reply.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/support-tickets/${selected.id}/replies`, { message: reply, is_internal_note: internalNote });
      const data = await api.get<AdminTicket>(`/admin/support-tickets/${selected.id}`);
      setSelected(data);
      setReply('');
      setInternalNote(false);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const companyName = (t: AdminTicket) => single(t.companies)?.name ?? '—';
  const assigneeName = (t: AdminTicket) => single(t.assignee)?.full_name ?? '—';

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} tickets across all companies</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.values(SupportTicketStatus).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Ticket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Support Ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Company (optional)</Label>
                  <Select value={newTicket.company_id} onValueChange={(v) => setNewTicket({ ...newTicket, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input value={newTicket.subject} onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={4} value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
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
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned To</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : tickets.map((t) => (
              <tr key={t.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => openTicket(t.id)}>
                <td className="px-4 py-3 font-medium">{t.subject}</td>
                <td className="px-4 py-3">{companyName(t)}</td>
                <td className="px-4 py-3"><Badge variant={statusVariant[t.status] || 'outline'} className="capitalize">{t.status.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-3"><Badge variant={priorityVariant[t.priority] || 'outline'} className="capitalize">{t.priority}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{assigneeName(t)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={selected.status} onValueChange={(v) => updateField('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(SupportTicketStatus).map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={selected.priority} onValueChange={(v) => updateField('priority', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(SupportTicketPriority).map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-lg divide-y">
                  {(selected.support_ticket_replies || []).length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No replies yet.</p>
                  ) : selected.support_ticket_replies!.map((r) => (
                    <div key={r.id} className={`px-3 py-2 ${r.is_internal_note ? 'bg-yellow-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">{single(r.author)?.full_name ?? 'Unknown'}{r.is_internal_note && <Badge variant="warning" className="ml-2">Internal note</Badge>}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{r.message}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <Label>Reply</Label>
                  <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Switch id="internal-note" checked={internalNote} onCheckedChange={setInternalNote} />
                      <Label htmlFor="internal-note">Internal note (not visible to customer)</Label>
                    </div>
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
