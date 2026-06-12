'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { TransactionStatus, TransactionType } from '@whatslark/shared';
import type { Transaction, Company } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';
import { useToast } from '@/hooks/use-toast';

type AdminTransaction = Transaction & { companies?: { name: string; slug: string } | { name: string; slug: string }[] };

const statusVariant: Record<string, any> = {
  pending: 'warning',
  completed: 'success',
  failed: 'destructive',
  refunded: 'secondary',
};

const emptyForm = {
  company_id: '',
  amount: '',
  currency: 'USD',
  type: TransactionType.SUBSCRIPTION,
  status: TransactionStatus.PENDING,
  payment_method: '',
  description: '',
};

export default function AdminTransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status !== 'all') params.set('status', status);
    api.get<{ data: AdminTransaction[]; total: number }>(`/admin/transactions?${params.toString()}`)
      .then((res) => { setTransactions(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, status]);

  useEffect(() => {
    api.get<{ data: Company[] }>('/admin/companies?limit=200')
      .then((res) => setCompanies(res.data))
      .catch(console.error);
  }, []);

  const companyName = (t: AdminTransaction) => {
    const co = t.companies;
    if (!co) return '—';
    return Array.isArray(co) ? co[0]?.name ?? '—' : co.name;
  };

  const handleSubmit = async () => {
    if (!form.company_id || !form.amount) {
      toast({ title: 'Company and amount are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/transactions', { ...form, amount: Number(form.amount) });
      toast({ title: 'Transaction created' });
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transactions Logs</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} transactions across all companies</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.values(TransactionStatus).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Transaction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Company</Label>
                  <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as TransactionType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(TransactionType).map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TransactionStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(TransactionStatus).map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="e.g. card, bank transfer" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Creating…' : 'Create Transaction'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment Method</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : transactions.map((t) => (
              <tr key={t.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{companyName(t)}</td>
                <td className="px-4 py-3 text-right">{t.currency} {Number(t.amount).toLocaleString()}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{t.type}</td>
                <td className="px-4 py-3"><Badge variant={statusVariant[t.status] || 'outline'} className="capitalize">{t.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{t.payment_method || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
