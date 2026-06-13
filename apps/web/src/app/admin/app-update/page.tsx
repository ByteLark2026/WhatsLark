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
import { AppPlatform } from '@whatslark/shared';
import type { AppVersion } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

const emptyForm = {
  platform: AppPlatform.ANDROID,
  version: '',
  build_number: '',
  release_notes: '',
  download_url: '',
  is_force_update: false,
  is_published: true,
};

export default function AdminAppUpdatePage() {
  const { toast } = useToast();
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppVersion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<AppVersion[]>('/admin/app-versions')
      .then(setVersions)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (v: AppVersion) => {
    setEditing(v);
    setForm({
      platform: v.platform,
      version: v.version,
      build_number: v.build_number != null ? String(v.build_number) : '',
      release_notes: v.release_notes || '',
      download_url: v.download_url || '',
      is_force_update: v.is_force_update,
      is_published: v.is_published,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.version) {
      toast({ title: 'Version is required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        build_number: form.build_number ? Number(form.build_number) : null,
      };
      if (editing) {
        await api.patch(`/admin/app-versions/${editing.id}`, payload);
        toast({ title: 'Version updated' });
      } else {
        await api.post('/admin/app-versions', payload);
        toast({ title: 'Version created' });
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (v: AppVersion) => {
    if (!window.confirm(`Delete version ${v.version}?`)) return;
    try {
      await api.delete(`/admin/app-versions/${v.id}`);
      toast({ title: 'Version deleted' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">App Update</h1>
          <p className="text-muted-foreground">Manage published app versions per platform</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Version</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit Version' : 'New Version'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Platform</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as AppPlatform })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(AppPlatform).map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Version</Label>
                  <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 1.4.0" />
                </div>
              </div>
              <div>
                <Label>Build Number</Label>
                <Input type="number" value={form.build_number} onChange={(e) => setForm({ ...form, build_number: e.target.value })} />
              </div>
              <div>
                <Label>Release Notes</Label>
                <Textarea rows={4} value={form.release_notes} onChange={(e) => setForm({ ...form, release_notes: e.target.value })} />
              </div>
              <div>
                <Label>Download URL</Label>
                <Input value={form.download_url} onChange={(e) => setForm({ ...form, download_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="force-update">Force Update</Label>
                  <Switch id="force-update" checked={form.is_force_update} onCheckedChange={(v) => setForm({ ...form, is_force_update: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-published">Published</Label>
                  <Switch id="is-published" checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Version'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Platform</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Version</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Build</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Force Update</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Published</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Released</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : versions.map((v) => (
              <tr key={v.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{v.platform}</Badge></td>
                <td className="px-4 py-3 font-medium">{v.version}</td>
                <td className="px-4 py-3 text-muted-foreground">{v.build_number ?? '—'}</td>
                <td className="px-4 py-3">{v.is_force_update ? <Badge variant="destructive">Forced</Badge> : <span className="text-muted-foreground text-xs">—</span>}</td>
                <td className="px-4 py-3">{v.is_published ? <Badge variant="success">Published</Badge> : <Badge variant="outline">Draft</Badge>}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(v.released_at)}</td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(v)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(v)} className="text-destructive focus:text-destructive">
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
    </div>
  );
}
