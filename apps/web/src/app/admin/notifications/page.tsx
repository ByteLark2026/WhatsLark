'use client';

import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { NotificationAudience, NotificationSeverity } from '@whatslark/shared';
import type { AdminNotification } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';
import { useToast } from '@/hooks/use-toast';

const severityVariant: Record<string, any> = {
  info: 'info',
  warning: 'warning',
  critical: 'destructive',
};

const emptyForm = {
  title: '',
  message: '',
  severity: NotificationSeverity.INFO,
  audience: NotificationAudience.ALL,
  is_published: true,
};

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminNotification | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  const load = () => {
    setLoading(true);
    api.get<{ data: AdminNotification[]; total: number }>(`/admin/notifications?page=${page}&limit=${limit}`)
      .then((res) => { setItems(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (n: AdminNotification) => {
    setEditing(n);
    setForm({
      title: n.title,
      message: n.message,
      severity: n.severity,
      audience: n.audience,
      is_published: n.is_published,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.message) {
      toast({ title: 'Title and message are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/admin/notifications/${editing.id}`, form);
        toast({ title: 'Notification updated' });
      } else {
        await api.post('/admin/notifications', form);
        toast({ title: 'Notification created' });
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (n: AdminNotification) => {
    if (!window.confirm(`Delete notification "${n.title}"?`)) return;
    try {
      await api.delete(`/admin/notifications/${n.id}`);
      toast({ title: 'Notification deleted' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} platform announcements</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Notification</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit Notification' : 'New Notification'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as NotificationSeverity })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(NotificationSeverity).map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Audience</Label>
                  <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v as NotificationAudience })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(NotificationAudience).map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is-published">Published</Label>
                <Switch id="is-published" checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Notification'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Severity</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Audience</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Published</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : items.map((n) => (
              <tr key={n.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[320px]">{n.message}</p>
                </td>
                <td className="px-4 py-3"><Badge variant={severityVariant[n.severity] || 'outline'} className="capitalize">{n.severity}</Badge></td>
                <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{n.audience}</Badge></td>
                <td className="px-4 py-3">
                  {n.is_published ? <Badge variant="success">Published</Badge> : <Badge variant="outline">Draft</Badge>}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(n.created_at)}</td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(n)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(n)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
