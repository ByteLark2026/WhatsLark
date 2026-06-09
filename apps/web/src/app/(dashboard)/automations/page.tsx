'use client';

import { useEffect, useState } from 'react';
import { Plus, Zap, Activity, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/layout/header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';

interface Flow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger: string;
  trigger_config: any;
  actions: any[];
  created_at: string;
  updated_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  message_received: 'message_received',
  keyword_matched: 'keyword_matched',
  new_contact: 'new_contact',
  new_conversation: 'new_conversation',
};

export default function AutomationsPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', trigger: 'message_received' });
  const [creating, setCreating] = useState(false);

  const totalExecutions = flows.reduce((s, f) => {
    const runs = f.trigger_config?.runs || 0;
    return s + runs;
  }, 0);
  const activeFlows = flows.filter((f) => f.is_active).length;

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) setFlows(data as unknown as Flow[]);
      setLoading(false);
    })();
  }, [company?.id]);

  const createFlow = async () => {
    if (!company?.id || !form.name) return;
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        company_id: company.id,
        name: form.name,
        is_active: false,
        trigger: form.trigger,
        trigger_config: {
          description: form.description,
          runs: 0,
          nodes: [],
          edges: [],
        },
        actions: [],
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setFlows((prev) => [data as unknown as Flow, ...prev]);
      setShowNew(false);
      setForm({ name: '', description: '', trigger: 'message_received' });
    }
    setCreating(false);
  };

  const toggleFlow = async (flow: Flow) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('automation_rules')
      .update({ is_active: !flow.is_active })
      .eq('id', flow.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setFlows((prev) => prev.map((f) => f.id === flow.id ? { ...f, is_active: !f.is_active } : f));
  };

  const deleteFlow = async (id: string) => {
    const supabase = createClient();
    await supabase.from('automation_rules').delete().eq('id', id);
    setFlows((prev) => prev.filter((f) => f.id !== id));
    toast({ title: 'Flow deleted' });
  };

  return (
    <div>
      <Header
        title="Automation Flows"
        subtitle="Create and manage conversation flows with drag-and-drop visual builder"
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" />Create New Flow
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Flows', value: flows.length, icon: Zap },
            { label: 'Active Flows', value: activeFlows, icon: Activity },
            { label: 'Total Executions', value: totalExecutions, icon: Activity },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Flow list */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : flows.length === 0 ? (
          <div className="text-center py-16">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">No automation flows yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Build visual conversation flows to automate your WhatsApp responses.</p>
            <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" />Create New Flow</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {flows.map((flow) => {
              const nodes: any[] = flow.trigger_config?.nodes || [];
              const edges: any[] = flow.trigger_config?.edges || [];
              const runs: number = flow.trigger_config?.runs || 0;
              const description = flow.trigger_config?.description || '';
              return (
                <Card key={flow.id} className={!flow.is_active ? 'opacity-70' : ''}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${flow.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="font-semibold text-sm truncate">{flow.name}</span>
                      </div>
                      <Switch
                        checked={flow.is_active}
                        onCheckedChange={() => toggleFlow(flow)}
                        className="flex-shrink-0"
                      />
                    </div>
                    {description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
                    )}
                    {!description && <p className="text-xs text-muted-foreground italic">No description</p>}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200">
                        ⚡ {TRIGGER_LABELS[flow.trigger] || flow.trigger}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {flow.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{nodes.length} nodes</span>
                      <span>{edges.length} edges</span>
                      <span>{runs} runs</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Link href={`/automations/${flow.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteFlow(flow.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New flow dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Flow</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Flow name *</Label>
              <Input
                placeholder="e.g. Welcome Message Flow"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What does this flow do?"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="message_received">Message Received</SelectItem>
                  <SelectItem value="keyword_matched">Keyword Matched</SelectItem>
                  <SelectItem value="new_contact">New Contact</SelectItem>
                  <SelectItem value="new_conversation">New Conversation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createFlow} disabled={creating || !form.name}>
              {creating && <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Create Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
