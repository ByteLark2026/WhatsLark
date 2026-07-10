'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, MoreVertical, Trash2, User, Calendar, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn, getInitials } from '@/lib/utils';

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'bg-gray-100 text-gray-700' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { key: 'review', label: 'Review', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'done', label: 'Done', color: 'bg-green-100 text-green-700' },
];

const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assigned_user?: { id: string; full_name?: string; avatar_url?: string };
}

const defaultForm = { title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assigned_to: '' };

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [board, setBoard] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState('todo');
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [proj, tasks] = await Promise.all([
      api.get<any>(`/projects/${id}`),
      api.get<any>(`/projects/${id}/tasks`),
    ]);
    setProject(proj);
    setBoard(tasks || {});
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const openAdd = (status: string) => {
    setEditing(null);
    setDefaultStatus(status);
    setForm({ ...defaultForm, status });
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      assigned_to: task.assigned_user?.id || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/projects/${id}/tasks/${editing.id}`, form);
      } else {
        await api.post(`/projects/${id}/tasks`, form);
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteTask = async (task: Task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await api.delete(`/projects/${id}/tasks/${task.id}`);
    load();
  };

  const moveTask = async (task: Task, newStatus: string) => {
    await api.patch(`/projects/${id}/tasks/${task.id}`, { status: newStatus });
    load();
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={project?.name || 'Project'}
        subtitle={project?.description || ''}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/projects')}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Projects
          </Button>
        }
      />
      <div className="flex-1 p-4 sm:p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-[800px] h-full">
          {COLUMNS.map((col) => {
            const tasks = board[col.key] || [];
            return (
              <div key={col.key} className="flex-1 min-w-[200px] flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-xs', col.color)}>{col.label}</Badge>
                    <span className="text-xs text-muted-foreground">{tasks.length}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAdd(col.key)}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {tasks.map((task) => (
                    <Card key={task.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openEdit(task)}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium line-clamp-2 flex-1">{task.title}</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 -mr-1 -mt-0.5">
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                                <DropdownMenuItem key={c.key} onClick={() => moveTask(task, c.key)}>
                                  Move to {c.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem className="text-destructive" onClick={() => deleteTask(task)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
                            <span className={cn('text-[10px] font-medium', PRIORITY_STYLES[task.priority])}>{task.priority}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {task.assigned_user && (
                              <Avatar className="w-5 h-5">
                                <AvatarImage src={task.assigned_user.avatar_url} />
                                <AvatarFallback className="text-[8px] bg-primary text-white">
                                  {getInitials(task.assigned_user.full_name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <button
                    onClick={() => openAdd(col.key)}
                    className="w-full text-left p-2 border border-dashed rounded-lg text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
                  >
                    + Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus />
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
                    {COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
