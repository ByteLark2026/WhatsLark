'use client';

import { useEffect, useState } from 'react';
import { Plus, FolderOpen, CheckSquare, Clock, MoreVertical, Pencil, Trash2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-600',
};

const PROJECT_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  color: string;
  due_date?: string;
  created_at: string;
  task_counts: { total: number; todo: number; in_progress: number; review: number; done: number };
}

const defaultForm = { name: '', description: '', color: '#6366f1', due_date: '', status: 'active' };

export default function ProjectsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    try {
      const data = await api.get<Project[]>('/projects');
      setProjects(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', color: p.color, due_date: p.due_date || '', status: p.status });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/projects/${editing.id}`, form);
        toast({ title: 'Project updated' });
      } else {
        await api.post('/projects', form);
        toast({ title: 'Project created' });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteProject = async (p: Project) => {
    if (!confirm(`Delete "${p.name}"? All tasks will be removed.`)) return;
    try {
      await api.delete(`/projects/${p.id}`);
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      toast({ title: 'Project deleted' });
    } catch {}
  };

  const archive = async (p: Project) => {
    await api.patch(`/projects/${p.id}`, { status: 'archived' });
    load();
  };

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

  return (
    <div>
      <Header
        title="Projects"
        subtitle="Manage projects and track tasks"
        actions={
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />New Project
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-44 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm mb-4">No projects yet</p>
            <Button size="sm" onClick={openCreate}>Create first project</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const done = p.task_counts.done;
              const total = p.task_counts.total;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Badge className={cn('text-[10px] shrink-0', STATUS_COLORS[p.status])}>{p.status.replace('_', ' ')}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => archive(p)}><Archive className="w-3.5 h-3.5 mr-2" />Archive</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteProject(p)}><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{done}/{total} tasks</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                      <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" />{p.task_counts.in_progress} in progress</span>
                      {p.due_date && <span className="flex items-center gap-1 ml-auto"><Clock className="w-3 h-3" />{new Date(p.due_date).toLocaleDateString()}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="h-20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map((c) => (
                  <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', form.color === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
