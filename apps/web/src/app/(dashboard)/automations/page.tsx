'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Zap, Activity, Pencil, Trash2, Sparkles, Send, Bot, User, Loader2, CheckCircle, Play, MessageSquare, FileText, Timer, GitBranch, Square, GraduationCap, Briefcase, ShoppingBag, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/layout/header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GeneratedFlow {
  name: string;
  trigger: string;
  trigger_config: any;
  nodes: any[];
  edges: any[];
}

const TRIGGER_LABELS: Record<string, string> = {
  message_received: 'Message received',
  keyword_matched: 'Keyword matched',
  new_contact: 'New contact',
  new_conversation: 'New conversation',
};

interface AgentTemplate {
  name: string;
  description: string;
  prompt: string;
}

interface AgentCategory {
  key: string;
  label: string;
  icon: typeof GraduationCap;
  description: string;
  templates: AgentTemplate[];
}

const AGENT_CATEGORIES: AgentCategory[] = [
  {
    key: 'edtech',
    label: 'EdTech',
    icon: GraduationCap,
    description: 'Coaching, courses & admissions',
    templates: [
      {
        name: 'New admission enquiry',
        description: 'Welcomes the enquirer, asks which course and preferred start date, saves the details, and notifies the admissions team.',
        prompt: 'When someone messages me for the first time, welcome them, ask which course they are interested in, then ask their preferred start date, save both answers as notes on the contact, and let them know an admissions counselor will follow up shortly.',
      },
      {
        name: 'Course fee enquiry auto-reply',
        description: 'Replies to fee/pricing questions with a short message and hands off to a human for details.',
        prompt: 'When someone messages me asking about fees or pricing, reply that fee details vary by course and a counselor will share the exact breakdown shortly, then assign the conversation to an agent.',
      },
    ],
  },
  {
    key: 'services',
    label: 'Services / Agencies',
    icon: Briefcase,
    description: 'Freelancers, studios & client work',
    templates: [
      {
        name: 'New client enquiry auto-reply',
        description: 'Greets a new enquirer, asks what service they need and their budget, saves it, and notifies the team.',
        prompt: 'When someone messages me for the first time, greet them, ask what service they are looking for, then ask their budget range, save both as notes on the contact, and tell them the team will get back to them within a few hours.',
      },
      {
        name: 'Appointment confirmation',
        description: 'Confirms a booked appointment/call back to the customer with the details they provided.',
        prompt: 'When someone messages me to book a call or meeting, ask for their preferred date and time, save it as a note on the contact, and confirm we will reach out to lock in the slot.',
      },
    ],
  },
  {
    key: 'retail',
    label: 'Retail',
    icon: ShoppingBag,
    description: 'Showroom & product sales',
    templates: [
      {
        name: 'Product enquiry auto-reply',
        description: 'Asks which product the customer is interested in and saves it for the sales team to follow up.',
        prompt: 'When someone messages me asking about a product, ask which product they are interested in and their preferred quantity, save both as notes on the contact, and let them know a team member will confirm availability and price shortly.',
      },
      {
        name: 'Store hours & location',
        description: 'Answers common location/hours questions automatically.',
        prompt: 'When someone messages me asking about store hours or location, reply with a placeholder message telling them our hours and address, and ask if they would like directions.',
      },
    ],
  },
  {
    key: 'enquiry_capturing',
    label: 'Enquiry Capturing',
    icon: ClipboardList,
    description: 'Capture and qualify every inbound enquiry',
    templates: [
      {
        name: 'Capture new enquiry details',
        description: 'Asks for name and what they need, saves both to the contact, and notifies the team — works for any business type.',
        prompt: 'When someone messages me for the first time, ask for their name, then ask what they are enquiring about, save both answers as notes on the contact, and notify the team that a new enquiry came in.',
      },
      {
        name: 'Qualify and tag interest',
        description: 'Asks what they are interested in and saves it, so every enquiry has a captured reason before a human joins.',
        prompt: 'When someone messages me, ask what they are interested in or what problem they need help with, save the answer as a note on the contact, then reply that a team member will follow up shortly.',
      },
    ],
  },
];

const NODE_LABELS: Record<string, { label: string; icon: typeof Play }> = {
  start: { label: 'Start', icon: Play },
  sendMessage: { label: 'Send Message', icon: MessageSquare },
  template: { label: 'Template', icon: FileText },
  delay: { label: 'Delay', icon: Timer },
  condition: { label: 'Condition', icon: GitBranch },
  end: { label: 'End', icon: Square },
};

export default function AutomationsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { company } = useAuthStore();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', trigger: 'message_received' });
  const [creating, setCreating] = useState(false);

  // AI Chat state
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [generatedFlow, setGeneratedFlow] = useState<GeneratedFlow | null>(null);
  const [savingFlow, setSavingFlow] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Agent template gallery
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<AgentCategory | null>(null);

  const totalExecutions = flows.reduce((s, f) => s + (f.trigger_config?.runs || 0), 0);
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  const openAiChat = () => {
    setChatHistory([{
      role: 'assistant',
      content: "Hi! I'll help you build an automation flow. Just describe what you want — for example: \"When someone messages me, send them a welcome message\" or \"When a customer asks about pricing, reply with our prices and wait 2 minutes then ask if they need more help\".",
    }]);
    setGeneratedFlow(null);
    setChatInput('');
    setShowAiChat(true);
  };

  const sendChatMessage = async (override?: string) => {
    const userMsg = (override ?? chatInput).trim();
    if (!userMsg || chatLoading) return;
    setChatInput('');
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);
    setChatLoading(true);

    try {
      const { data: sessionData } = await createClient().auth.getSession();
      const res = await fetch('/api/automations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: userMsg,
          history: newHistory.slice(0, -1), // exclude the message we just added — it's in `message`
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: 'AI error', description: json.error, variant: 'destructive' });
        setChatLoading(false);
        return;
      }
      setChatHistory((prev) => [...prev, { role: 'assistant', content: json.reply }]);
      if (json.flow) setGeneratedFlow(json.flow);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setChatLoading(false);
  };

  const useTemplate = (tpl: AgentTemplate) => {
    setShowTemplates(false);
    setTemplateCategory(null);
    setChatHistory([{
      role: 'assistant',
      content: "Hi! I'll help you build an automation flow. Just describe what you want — for example: \"When someone messages me, send them a welcome message\" or \"When a customer asks about pricing, reply with our prices and wait 2 minutes then ask if they need more help\".",
    }]);
    setGeneratedFlow(null);
    setShowAiChat(true);
    sendChatMessage(tpl.prompt);
  };

  const saveGeneratedFlow = async () => {
    if (!generatedFlow || !company?.id) return;
    setSavingFlow(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        company_id: company.id,
        name: generatedFlow.name,
        is_active: false,
        trigger: generatedFlow.trigger,
        trigger_config: {
          ...generatedFlow.trigger_config,
          nodes: generatedFlow.nodes,
          edges: generatedFlow.edges,
          runs: 0,
        },
        actions: [],
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error saving flow', description: error.message, variant: 'destructive' });
      setSavingFlow(false);
      return;
    }

    toast({ title: 'Flow created! Opening editor…' });
    setShowAiChat(false);
    router.push(`/automations/${data.id}`);
  };

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
        trigger_config: { description: form.description, runs: 0, nodes: [], edges: [] },
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
    const { error } = await supabase.from('automation_rules').update({ is_active: !flow.is_active }).eq('id', flow.id);
    if (!error) setFlows((prev) => prev.map((f) => f.id === flow.id ? { ...f, is_active: !f.is_active } : f));
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
        subtitle="Create and manage conversation flows to automate WhatsApp responses"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setTemplateCategory(null); setShowTemplates(true); }}>
              <Bot className="w-4 h-4 mr-2 text-primary" />Agent templates
            </Button>
            <Button size="sm" variant="outline" onClick={openAiChat}>
              <Sparkles className="w-4 h-4 mr-2 text-purple-500" />Create with AI
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" />New Flow
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : flows.length === 0 ? (
          <div className="text-center py-16">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">No automation flows yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Build flows visually or let AI create one from your description.</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={openAiChat}><Sparkles className="w-4 h-4 mr-2 text-purple-500" />Create with AI</Button>
              <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" />New Flow</Button>
            </div>
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
                      <Switch checked={flow.is_active} onCheckedChange={() => toggleFlow(flow)} className="flex-shrink-0" />
                    </div>
                    {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200 gap-1">
                        <Zap className="w-3 h-3" /> {TRIGGER_LABELS[flow.trigger] || flow.trigger}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{flow.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{nodes.length} nodes</span>
                      <span>{runs} runs</span>
                      <span>{formatRelativeTime(flow.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Link href={`/automations/${flow.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteFlow(flow.id)}>
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

      {/* Manual new flow dialog */}
      {/* Agent template gallery */}
      <Dialog open={showTemplates} onOpenChange={(open) => { setShowTemplates(open); if (!open) setTemplateCategory(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{templateCategory ? templateCategory.label : 'Agent category'}</DialogTitle>
            <DialogDescription>
              {templateCategory ? 'Pick a ready-made flow to start from.' : 'Choose the category closest to your business to see ready-made automation flows.'}
            </DialogDescription>
          </DialogHeader>
          {!templateCategory ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {AGENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setTemplateCategory(cat)}
                  className="text-left border rounded-xl p-4 hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center mb-2">
                    <cat.icon className="w-4.5 h-4.5" />
                  </div>
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setTemplateCategory(null)}>← Back to categories</Button>
              {templateCategory.templates.map((tpl) => (
                <div key={tpl.name} className="border rounded-xl p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>
                  </div>
                  <Button size="sm" className="flex-shrink-0" onClick={() => useTemplate(tpl)}>Use template</Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Flow</DialogTitle>
            <DialogDescription>Set up a blank automation flow — you'll build the steps in the flow editor next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Flow name *</Label>
              <Input placeholder="e.g. Welcome Message Flow" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What does this flow do?" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Chat dialog */}
      <Dialog open={showAiChat} onOpenChange={setShowAiChat}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              Create Automation with AI
            </DialogTitle>
            <DialogDescription className="sr-only">Describe the automation you want and the AI will build the flow for you.</DialogDescription>
          </DialogHeader>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.map((msg, i) => (
              <div key={i} className={cn('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-muted rounded-bl-sm',
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Generated flow preview */}
          {generatedFlow && (
            <div className="mx-4 mb-3 rounded-xl border border-green-200 bg-green-50 p-3 flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-green-800 truncate">{generatedFlow.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700 gap-1">
                      <Zap className="w-3 h-3" /> {TRIGGER_LABELS[generatedFlow.trigger] || generatedFlow.trigger}
                    </Badge>
                    <span className="text-xs text-green-700">{generatedFlow.nodes.length} nodes</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {generatedFlow.nodes
                      .filter((n: any) => n.type !== 'start')
                      .map((n: any, i: number) => (
                        <span key={i} className="text-xs bg-white border border-green-200 rounded px-1.5 py-0.5 text-green-800 inline-flex items-center gap-1">
                          {NODE_LABELS[n.type] ? (() => { const Icon = NODE_LABELS[n.type].icon; return <><Icon className="w-3 h-3" />{NODE_LABELS[n.type].label}</>; })() : n.type}
                        </span>
                      ))}
                  </div>
                </div>
                <Button size="sm" onClick={saveGeneratedFlow} disabled={savingFlow} className="bg-green-600 hover:bg-green-700 flex-shrink-0">
                  {savingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Edit'}
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 flex-shrink-0 border-t pt-3">
            <div className="flex gap-2">
              <Input
                placeholder="Describe your automation… e.g. Send a welcome message when someone texts me"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                disabled={chatLoading}
                className="flex-1"
              />
              <Button size="icon" onClick={() => sendChatMessage()} disabled={chatLoading || !chatInput.trim()}>
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Press Enter to send · AI will generate a complete flow you can edit</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
