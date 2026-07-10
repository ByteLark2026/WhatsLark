'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection, type NodeTypes,
  Handle, Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  MessageSquare, HelpCircle, FileText, List, Image, MapPin,
  GitBranch, Clock, Variable, UserCheck, Webhook, BookOpen,
  XCircle, UserPlus, RefreshCw, ArrowLeft, Save, Plus, Loader2,
  ChevronDown, Zap, Blocks, Settings2, Play, CheckCircle2,
  AlertCircle, SkipForward, Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────
interface FlowNodeData {
  label: string;
  type: string;
  config?: Record<string, any>;
  [key: string]: unknown;
}

interface TestStep {
  nodeId: string;
  type: string;
  label: string;
  result: 'executed' | 'skipped' | 'branch_yes' | 'branch_no' | 'end';
  detail?: string;
}

// ─── Node renderers ──────────────────────────────────────────────────────────
function BaseNode({ data, selected, color, icon: Icon, children }: {
  data: FlowNodeData; selected: boolean; color: string;
  icon: React.ComponentType<any>; children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      'min-w-[170px] rounded-xl border-2 bg-white shadow-sm transition-shadow text-xs',
      selected ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50',
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !border-white !w-3 !h-3" />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${color}`}>
            <Icon className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-gray-800 truncate">{data.label}</span>
        </div>
        {children}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !border-white !w-3 !h-3" />
    </div>
  );
}

function StartNode({ selected }: { data: FlowNodeData; selected: boolean }) {
  return (
    <div className={cn(
      'w-16 h-16 rounded-full border-4 flex items-center justify-center shadow-lg transition-all bg-green-500',
      selected ? 'border-primary' : 'border-green-600',
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-green-700 !border-white !w-3 !h-3" />
      <Zap className="w-6 h-6 text-white" />
    </div>
  );
}

function ConditionNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  return (
    <div className={cn(
      'min-w-[170px] rounded-xl border-2 bg-white shadow-sm transition-shadow text-xs',
      selected ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50',
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !border-white !w-3 !h-3" />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-purple-500">
            <GitBranch className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{data.label}</span>
        </div>
        {data.config?.conditionValue && (
          <p className="text-gray-500 truncate">{data.config.conditionValue}</p>
        )}
        <div className="flex justify-between mt-2 text-[10px]">
          <span className="text-green-600 font-medium">✓ Yes →</span>
          <span className="text-red-500 font-medium">← No ✗</span>
        </div>
      </div>
      <Handle type="source" id="yes" position={Position.Left} className="!bg-green-500 !border-white !w-3 !h-3" style={{ top: '65%' }} />
      <Handle type="source" id="no" position={Position.Right} className="!bg-red-500 !border-white !w-3 !h-3" style={{ top: '65%' }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode as any,
  sendMessage: (p: any) => (
    <BaseNode {...p} color="bg-blue-500" icon={MessageSquare}>
      {p.data.config?.message && <p className="text-gray-500 truncate max-w-[140px]">{p.data.config.message}</p>}
    </BaseNode>
  ),
  askQuestion: (p: any) => (
    <BaseNode {...p} color="bg-yellow-500" icon={HelpCircle}>
      {p.data.config?.question && <p className="text-gray-500 truncate max-w-[140px]">{p.data.config.question}</p>}
      {p.data.config?.variable && <p className="text-[10px] text-blue-500">→ {'{{'}{p.data.config.variable}{'}}'}</p>}
    </BaseNode>
  ),
  template: (p: any) => (
    <BaseNode {...p} color="bg-green-500" icon={FileText}>
      {p.data.config?.template && <p className="text-gray-500 truncate">{p.data.config.template}</p>}
    </BaseNode>
  ),
  listMsg: (p: any) => (
    <BaseNode {...p} color="bg-indigo-500" icon={List}>
      {p.data.config?.header && <p className="text-gray-500 truncate">{p.data.config.header}</p>}
    </BaseNode>
  ),
  media: (p: any) => (
    <BaseNode {...p} color="bg-pink-500" icon={Image}>
      {p.data.config?.mediaType && <p className="text-gray-500 capitalize">{p.data.config.mediaType}</p>}
    </BaseNode>
  ),
  location: (p: any) => (
    <BaseNode {...p} color="bg-red-500" icon={MapPin}>
      {p.data.config?.locationName && <p className="text-gray-500 truncate">{p.data.config.locationName}</p>}
    </BaseNode>
  ),
  condition: ConditionNode as any,
  delay: (p: any) => (
    <BaseNode {...p} color="bg-gray-500" icon={Clock}>
      {(p.data.config?.delayValue && p.data.config?.delayUnit) && (
        <p className="text-gray-500">{p.data.config.delayValue} {p.data.config.delayUnit}</p>
      )}
    </BaseNode>
  ),
  variable: (p: any) => (
    <BaseNode {...p} color="bg-cyan-500" icon={Variable}>
      {p.data.config?.varName && <p className="text-gray-500 truncate">{p.data.config.varName} = {p.data.config?.varValue || '?'}</p>}
    </BaseNode>
  ),
  assign: (p: any) => (
    <BaseNode {...p} color="bg-teal-500" icon={UserCheck}>
      {p.data.config?.assignTo && <p className="text-gray-500 truncate">{p.data.config.assignTo}</p>}
    </BaseNode>
  ),
  webhook: (p: any) => (
    <BaseNode {...p} color="bg-orange-500" icon={Webhook}>
      {p.data.config?.url && <p className="text-gray-500 truncate max-w-[140px]">{p.data.config.method || 'POST'} {p.data.config.url}</p>}
    </BaseNode>
  ),
  read: (p: any) => <BaseNode {...p} color="bg-lime-500" icon={BookOpen} />,
  end: (p: any) => (
    <div className={cn(
      'w-12 h-12 rounded-full border-2 flex items-center justify-center',
      p.selected ? 'border-primary' : 'border-red-400',
      'bg-red-100',
    )}>
      <Handle type="target" position={Position.Top} className="!bg-red-400 !border-white !w-3 !h-3" />
      <XCircle className="w-5 h-5 text-red-500" />
    </div>
  ),
  addGroup: (p: any) => (
    <BaseNode {...p} color="bg-emerald-500" icon={UserPlus}>
      {p.data.config?.group && <p className="text-gray-500 truncate">{p.data.config.group}</p>}
    </BaseNode>
  ),
  update: (p: any) => (
    <BaseNode {...p} color="bg-violet-500" icon={RefreshCw}>
      {p.data.config?.field && <p className="text-gray-500">{p.data.config.field} = {p.data.config?.value || '?'}</p>}
    </BaseNode>
  ),
};

// ─── Palette ─────────────────────────────────────────────────────────────────
const PALETTE_NODES = [
  {
    category: 'MESSAGES',
    nodes: [
      { type: 'sendMessage', label: 'Send Message', icon: MessageSquare, color: 'bg-blue-500' },
      { type: 'askQuestion', label: 'Ask Question', icon: HelpCircle, color: 'bg-yellow-500' },
      { type: 'template', label: 'Template', icon: FileText, color: 'bg-green-500' },
      { type: 'listMsg', label: 'List Msg', icon: List, color: 'bg-indigo-500' },
      { type: 'media', label: 'Media', icon: Image, color: 'bg-pink-500' },
      { type: 'location', label: 'Location', icon: MapPin, color: 'bg-red-500' },
    ],
  },
  {
    category: 'LOGIC & FLOW',
    nodes: [
      { type: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-purple-500' },
      { type: 'delay', label: 'Delay', icon: Clock, color: 'bg-gray-500' },
      { type: 'variable', label: 'Variable', icon: Variable, color: 'bg-cyan-500' },
    ],
  },
  {
    category: 'ACTIONS',
    nodes: [
      { type: 'assign', label: 'Assign', icon: UserCheck, color: 'bg-teal-500' },
      { type: 'webhook', label: 'Webhook', icon: Webhook, color: 'bg-orange-500' },
      { type: 'read', label: 'Read', icon: BookOpen, color: 'bg-lime-500' },
      { type: 'end', label: 'End', icon: XCircle, color: 'bg-red-400' },
    ],
  },
  {
    category: 'CONTACTS',
    nodes: [
      { type: 'addGroup', label: 'Add Group', icon: UserPlus, color: 'bg-emerald-500' },
      { type: 'update', label: 'Update', icon: RefreshCw, color: 'bg-violet-500' },
    ],
  },
];

const TRIGGERS = [
  { value: 'message_received', label: 'Message received' },
  { value: 'keyword_matched', label: 'Keyword matched' },
  { value: 'new_contact', label: 'New contact' },
  { value: 'new_conversation', label: 'New conversation' },
];

let nodeCounter = 100;
function nextId() { return `node_${++nodeCounter}`; }

// ─── Main component ───────────────────────────────────────────────────────────
export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { company } = useAuthStore();

  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [trigger, setTrigger] = useState('message_received');
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; language: string }[]>([]);

  // Test flow
  const [showTest, setShowTest] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);
  const [testRan, setTestRan] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load flow + templates
  useEffect(() => {
    if (!id || !company?.id) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('automation_rules').select('*').eq('id', id).eq('company_id', company.id).single(),
      supabase.from('message_templates').select('id, name, language').eq('company_id', company.id).eq('status', 'approved'),
    ]).then(([{ data }, { data: tpls }]) => {
      if (tpls) setTemplates(tpls as any[]);
      if (data) {
        setFlowName(data.name);
        setTrigger(data.trigger);
        setFlowDescription(data.trigger_config?.description || '');
        setTriggerKeywords(data.trigger_config?.keywords || []);
        const savedNodes = data.trigger_config?.nodes || [];
        setNodes(savedNodes.length === 0
          ? [{ id: 'start', type: 'start', position: { x: 250, y: 80 }, data: { label: 'START', type: 'start' } }]
          : savedNodes);
        setEdges(data.trigger_config?.edges || []);
      }
      setLoading(false);
    });
  }, [id, company?.id]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8' } }, eds)),
    [setEdges],
  );

  const addNode = (type: string, label: string) => {
    const newNode: Node<FlowNodeData> = {
      id: nextId(),
      type,
      position: { x: 180 + Math.random() * 120, y: 180 + nodes.length * 120 },
      data: { label, type, config: {} },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = async () => {
    if (!company?.id || !id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('automation_rules').update({
      name: flowName,
      trigger,
      trigger_config: { description: flowDescription, keywords: triggerKeywords, runs: 0, nodes, edges },
    }).eq('id', id);
    if (error) toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    else toast({ title: 'Flow saved' });
    setSaving(false);
  };

  const onNodeClick = useCallback((_: any, node: Node<FlowNodeData>) => {
    setSelectedNode(node);
    if (window.innerWidth < 1024) setShowProperties(true);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const updateNodeConfig = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) =>
      n.id === selectedNode.id ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } } : n
    ));
    setSelectedNode((prev) => prev
      ? { ...prev, data: { ...prev.data, config: { ...prev.data.config, [key]: value } } }
      : prev);
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setShowProperties(false);
  };

  // ─── Test flow simulation ────────────────────────────────────────────────
  const runTest = () => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const steps: TestStep[] = [];
    let vars: Record<string, string> = {};
    let currentId = 'start';
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = nodeMap.get(currentId);
      if (!node) break;

      if (node.type === 'start') {
        steps.push({ nodeId: node.id, type: 'start', label: 'Trigger fired', result: 'executed', detail: trigger === 'keyword_matched' ? `Keywords: ${triggerKeywords.join(', ')}` : trigger });
        const next = edges.find((e) => e.source === currentId);
        currentId = next?.target || '';
        continue;
      }

      if (node.type === 'end') {
        steps.push({ nodeId: node.id, type: 'end', label: 'Flow ended', result: 'end' });
        break;
      }

      if (node.type === 'condition') {
        const ct = node.data.config?.conditionType || 'message_contains';
        const cv = node.data.config?.conditionValue || '';
        let result = false;
        if (ct === 'always_true') result = true;
        else if (ct === 'message_contains') result = testMessage.toLowerCase().includes(cv.toLowerCase());
        else if (ct === 'message_equals') result = testMessage.toLowerCase() === cv.toLowerCase();
        else if (ct === 'variable_equals') {
          const [varName, varVal] = cv.split('=').map((s: string) => s.trim());
          result = vars[varName] === varVal;
        }
        steps.push({
          nodeId: node.id, type: 'condition', label: node.data.label,
          result: result ? 'branch_yes' : 'branch_no',
          detail: `${ct}: "${cv}" → ${result ? 'YES' : 'NO'}`,
        });
        const handle = result ? 'yes' : 'no';
        const next = edges.find((e) => e.source === currentId && e.sourceHandle === handle)
          || edges.find((e) => e.source === currentId);
        currentId = next?.target || '';
        continue;
      }

      if (node.type === 'variable') {
        const k = node.data.config?.varName || '';
        const v = node.data.config?.varValue || '';
        const resolved = v === '{{message}}' ? testMessage : v;
        if (k) vars[k] = resolved;
        steps.push({ nodeId: node.id, type: 'variable', label: node.data.label, result: 'executed', detail: `${k} = "${resolved}"` });
      } else if (node.type === 'delay') {
        steps.push({ nodeId: node.id, type: 'delay', label: node.data.label, result: 'executed', detail: `Wait ${node.data.config?.delayValue || '?'} ${node.data.config?.delayUnit || 'seconds'}` });
      } else if (node.type === 'sendMessage') {
        const msg = (node.data.config?.message || '').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] || `{{${k}}}`);
        steps.push({ nodeId: node.id, type: 'sendMessage', label: node.data.label, result: 'executed', detail: `"${msg.substring(0, 60)}${msg.length > 60 ? '…' : ''}"` });
      } else if (node.type === 'askQuestion') {
        steps.push({ nodeId: node.id, type: 'askQuestion', label: node.data.label, result: 'executed', detail: node.data.config?.question || '' });
      } else if (node.type === 'template') {
        steps.push({ nodeId: node.id, type: 'template', label: node.data.label, result: 'executed', detail: `Template: ${node.data.config?.template || 'not set'}` });
      } else if (node.type === 'media') {
        steps.push({ nodeId: node.id, type: 'media', label: node.data.label, result: 'executed', detail: `${node.data.config?.mediaType || 'image'}: ${node.data.config?.mediaUrl?.substring(0, 40) || 'no URL'}` });
      } else if (node.type === 'webhook') {
        steps.push({ nodeId: node.id, type: 'webhook', label: node.data.label, result: 'executed', detail: `${node.data.config?.method || 'POST'} ${node.data.config?.url || 'no URL'}` });
      } else if (node.type === 'assign') {
        steps.push({ nodeId: node.id, type: 'assign', label: node.data.label, result: 'executed', detail: `Assign to: ${node.data.config?.assignTo || 'unassigned'}` });
      } else if (node.type === 'addGroup') {
        steps.push({ nodeId: node.id, type: 'addGroup', label: node.data.label, result: 'executed', detail: `Tag: ${node.data.config?.group || 'none'}` });
      } else if (node.type === 'update') {
        steps.push({ nodeId: node.id, type: 'update', label: node.data.label, result: 'executed', detail: `${node.data.config?.field || 'field'} = ${node.data.config?.value || '?'}` });
      } else if (node.type === 'location') {
        steps.push({ nodeId: node.id, type: 'location', label: node.data.label, result: 'executed', detail: node.data.config?.locationName || 'location' });
      } else if (node.type === 'listMsg') {
        steps.push({ nodeId: node.id, type: 'listMsg', label: node.data.label, result: 'executed', detail: node.data.config?.header || 'list message' });
      } else if (node.type === 'read') {
        steps.push({ nodeId: node.id, type: 'read', label: node.data.label, result: 'executed', detail: 'Mark conversation as read' });
      } else {
        steps.push({ nodeId: node.id, type: node.type ?? 'unknown', label: node.data.label, result: 'skipped' });
      }

      const next = edges.find((e) => e.source === currentId);
      currentId = next?.target || '';
    }

    setTestSteps(steps);
    setTestRan(true);
  };

  // ─── Keyword tag input ───────────────────────────────────────────────────
  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !triggerKeywords.includes(kw)) setTriggerKeywords((k) => [...k, kw]);
    setKwInput('');
  };

  // ─── Property panel ──────────────────────────────────────────────────────
  const propertiesContent = (
    <>
      <div className="p-3 border-b flex items-center gap-2 flex-shrink-0">
        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
          <Settings2 className="w-3.5 h-3.5 text-primary" />
        </div>
        <p className="text-xs font-semibold">Node Properties</p>
      </div>
      <div className="flex-1 p-3 overflow-y-auto">
        {!selectedNode ? (
          <p className="text-xs text-muted-foreground mt-4 text-center">Click a node on the canvas to edit settings</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-primary capitalize flex-1">{selectedNode.data.type} node</p>
            </div>

            {/* Label */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input className="h-7 text-xs" value={selectedNode.data.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, label } } : n));
                  setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, label } } : prev);
                }} />
            </div>

            {/* sendMessage */}
            {selectedNode.data.type === 'sendMessage' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Message text</Label>
                <Textarea className="text-xs resize-none" rows={5}
                  placeholder="Hello {{name}}, how can I help you?"
                  value={selectedNode.data.config?.message || ''}
                  onChange={(e) => updateNodeConfig('message', e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Use {'{{variable_name}}'} to insert saved variables</p>
              </div>
            )}

            {/* askQuestion */}
            {selectedNode.data.type === 'askQuestion' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Question</Label>
                <Textarea className="text-xs resize-none" rows={3}
                  placeholder="What is your name?"
                  value={selectedNode.data.config?.question || ''}
                  onChange={(e) => updateNodeConfig('question', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Save reply to variable</Label>
                <Input className="h-7 text-xs" placeholder="e.g. user_name"
                  value={selectedNode.data.config?.variable || ''}
                  onChange={(e) => updateNodeConfig('variable', e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Use {'{{user_name}}'} in later nodes</p>
              </div>
            )}

            {/* template */}
            {selectedNode.data.type === 'template' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Approved template</Label>
                <Select value={selectedNode.data.config?.template || ''} onValueChange={(v) => updateNodeConfig('template', v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select template…" /></SelectTrigger>
                  <SelectContent>
                    {templates.length === 0
                      ? <SelectItem value="__none" disabled>No approved templates</SelectItem>
                      : templates.map((t) => (
                        <SelectItem key={t.id} value={t.name} className="text-xs">{t.name} ({t.language.toUpperCase()})</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* listMsg */}
            {selectedNode.data.type === 'listMsg' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Header</Label>
                <Input className="h-7 text-xs" placeholder="Choose an option"
                  value={selectedNode.data.config?.header || ''}
                  onChange={(e) => updateNodeConfig('header', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Body</Label>
                <Textarea className="text-xs resize-none" rows={2} placeholder="Please select from the list below"
                  value={selectedNode.data.config?.body || ''}
                  onChange={(e) => updateNodeConfig('body', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Button label</Label>
                <Input className="h-7 text-xs" placeholder="View options"
                  value={selectedNode.data.config?.buttonText || ''}
                  onChange={(e) => updateNodeConfig('buttonText', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Options (one per line)</Label>
                <Textarea className="text-xs resize-none" rows={4} placeholder={"Option 1\nOption 2\nOption 3"}
                  value={selectedNode.data.config?.options || ''}
                  onChange={(e) => updateNodeConfig('options', e.target.value)} />
              </div>
            )}

            {/* media */}
            {selectedNode.data.type === 'media' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Media type</Label>
                <Select value={selectedNode.data.config?.mediaType || 'image'} onValueChange={(v) => updateNodeConfig('mediaType', v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="text-xs text-muted-foreground">Media URL</Label>
                <Input className="h-7 text-xs" placeholder="https://..."
                  value={selectedNode.data.config?.mediaUrl || ''}
                  onChange={(e) => updateNodeConfig('mediaUrl', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Caption (optional)</Label>
                <Input className="h-7 text-xs" placeholder="Caption text"
                  value={selectedNode.data.config?.caption || ''}
                  onChange={(e) => updateNodeConfig('caption', e.target.value)} />
              </div>
            )}

            {/* location */}
            {selectedNode.data.type === 'location' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Location name</Label>
                <Input className="h-7 text-xs" placeholder="Our Store"
                  value={selectedNode.data.config?.locationName || ''}
                  onChange={(e) => updateNodeConfig('locationName', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input className="h-7 text-xs" placeholder="123 Main Street"
                  value={selectedNode.data.config?.address || ''}
                  onChange={(e) => updateNodeConfig('address', e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Latitude</Label>
                    <Input className="h-7 text-xs" placeholder="24.7136"
                      value={selectedNode.data.config?.lat || ''}
                      onChange={(e) => updateNodeConfig('lat', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Longitude</Label>
                    <Input className="h-7 text-xs" placeholder="46.6753"
                      value={selectedNode.data.config?.lng || ''}
                      onChange={(e) => updateNodeConfig('lng', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* condition */}
            {selectedNode.data.type === 'condition' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Condition type</Label>
                <Select value={selectedNode.data.config?.conditionType || 'message_contains'} onValueChange={(v) => updateNodeConfig('conditionType', v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message_contains">Message contains</SelectItem>
                    <SelectItem value="message_equals">Message equals</SelectItem>
                    <SelectItem value="variable_equals">Variable equals (var=val)</SelectItem>
                    <SelectItem value="always_true">Always yes</SelectItem>
                  </SelectContent>
                </Select>
                {selectedNode.data.config?.conditionType !== 'always_true' && (
                  <>
                    <Label className="text-xs text-muted-foreground">
                      {selectedNode.data.config?.conditionType === 'variable_equals' ? 'Variable = Value' : 'Keyword / phrase'}
                    </Label>
                    <Input className="h-7 text-xs"
                      placeholder={selectedNode.data.config?.conditionType === 'variable_equals' ? 'user_intent = pricing' : 'yes, ok, sure'}
                      value={selectedNode.data.config?.conditionValue || ''}
                      onChange={(e) => updateNodeConfig('conditionValue', e.target.value)} />
                  </>
                )}
                <div className="rounded-lg border p-2 space-y-1 mt-1">
                  <p className="text-[10px] text-green-600 font-medium">✓ Left handle → Yes path</p>
                  <p className="text-[10px] text-red-500 font-medium">✗ Right handle → No path</p>
                  <p className="text-[10px] text-muted-foreground">Drag from the coloured dots on each side</p>
                </div>
              </div>
            )}

            {/* delay */}
            {selectedNode.data.type === 'delay' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <div className="flex gap-2">
                  <Input className="h-7 text-xs flex-1" type="number" min="1" placeholder="5"
                    value={selectedNode.data.config?.delayValue || ''}
                    onChange={(e) => updateNodeConfig('delayValue', e.target.value)} />
                  <Select value={selectedNode.data.config?.delayUnit || 'seconds'} onValueChange={(v) => updateNodeConfig('delayUnit', v)}>
                    <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">seconds</SelectItem>
                      <SelectItem value="minutes">minutes</SelectItem>
                      <SelectItem value="hours">hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">Max 10s in live execution (Vercel limit)</p>
              </div>
            )}

            {/* variable */}
            {selectedNode.data.type === 'variable' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Variable name</Label>
                <Input className="h-7 text-xs" placeholder="e.g. user_intent"
                  value={selectedNode.data.config?.varName || ''}
                  onChange={(e) => updateNodeConfig('varName', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Value</Label>
                <Input className="h-7 text-xs" placeholder="{{message}} or static text"
                  value={selectedNode.data.config?.varValue || ''}
                  onChange={(e) => updateNodeConfig('varValue', e.target.value)} />
                <p className="text-[10px] text-muted-foreground">{'{{message}}'} = the incoming message text</p>
              </div>
            )}

            {/* assign */}
            {selectedNode.data.type === 'assign' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assign to (email or "unassigned")</Label>
                <Input className="h-7 text-xs" placeholder="agent@company.com"
                  value={selectedNode.data.config?.assignTo || ''}
                  onChange={(e) => updateNodeConfig('assignTo', e.target.value)} />
              </div>
            )}

            {/* webhook */}
            {selectedNode.data.type === 'webhook' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Method</Label>
                <Select value={selectedNode.data.config?.method || 'POST'} onValueChange={(v) => updateNodeConfig('method', v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="text-xs text-muted-foreground">URL</Label>
                <Input className="h-7 text-xs" placeholder="https://hooks.example.com/..."
                  value={selectedNode.data.config?.url || ''}
                  onChange={(e) => updateNodeConfig('url', e.target.value)} />
                <Label className="text-xs text-muted-foreground">Body (JSON, optional)</Label>
                <Textarea className="text-xs resize-none font-mono" rows={3}
                  placeholder={'{"message": "{{message}}"}'}
                  value={selectedNode.data.config?.body || ''}
                  onChange={(e) => updateNodeConfig('body', e.target.value)} />
              </div>
            )}

            {/* addGroup */}
            {selectedNode.data.type === 'addGroup' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tag / group name</Label>
                <Input className="h-7 text-xs" placeholder="e.g. VIP, Hot Lead, Interested"
                  value={selectedNode.data.config?.group || ''}
                  onChange={(e) => updateNodeConfig('group', e.target.value)} />
              </div>
            )}

            {/* update contact */}
            {selectedNode.data.type === 'update' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Field to update</Label>
                <Select value={selectedNode.data.config?.field || 'name'} onValueChange={(v) => updateNodeConfig('field', v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="notes">Notes</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="text-xs text-muted-foreground">Value</Label>
                <Input className="h-7 text-xs" placeholder="{{message}} or static"
                  value={selectedNode.data.config?.value || ''}
                  onChange={(e) => updateNodeConfig('value', e.target.value)} />
              </div>
            )}

            {/* Delete */}
            {selectedNode.data.type !== 'start' && selectedNode.data.type !== 'end' && (
              <Button variant="destructive" size="sm" className="w-full text-xs h-7 mt-2" onClick={deleteNode}>
                Delete Node
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );

  // ─── Palette content ─────────────────────────────────────────────────────
  const paletteContent = (
    <>
      <div className="p-3 border-b flex-shrink-0">
        <p className="text-xs font-semibold text-muted-foreground">Flow Nodes</p>
        <p className="text-xs text-muted-foreground">Click to add</p>
      </div>
      <div className="p-2 space-y-4 flex-1 overflow-y-auto">
        {PALETTE_NODES.map((group) => (
          <div key={group.category}>
            <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">{group.category}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {group.nodes.map((node) => (
                <button key={node.type}
                  onClick={() => { addNode(node.type, node.label); setShowPalette(false); }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${node.color}`}>
                    <node.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs leading-tight">{node.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left palette desktop */}
      <div className="hidden lg:flex w-52 border-r bg-background flex-col overflow-y-auto">
        {paletteContent}
      </div>

      {/* Left palette mobile */}
      <Sheet open={showPalette} onOpenChange={setShowPalette}>
        <SheetContent side="left" className="w-64 max-w-[85vw] p-0 bg-background text-foreground flex flex-col">
          <SheetTitle className="sr-only">Flow nodes</SheetTitle>
          {paletteContent}
        </SheetContent>
      </Sheet>

      {/* Right properties mobile */}
      <Sheet open={showProperties} onOpenChange={setShowProperties}>
        <SheetContent side="right" className="w-72 max-w-[90vw] p-0 bg-background text-foreground flex flex-col">
          <SheetTitle className="sr-only">Node properties</SheetTitle>
          {propertiesContent}
        </SheetContent>
      </Sheet>

      {/* Center canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 px-2 sm:px-4 py-2.5 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={() => router.push('/automations')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setShowPalette(true)}>
            <Blocks className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-[120px]">
            <input className="font-semibold bg-transparent outline-none border-0 text-sm w-full"
              value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Flow name…" />
            <input className="text-xs text-muted-foreground bg-transparent outline-none border-0 w-full"
              value={flowDescription} onChange={(e) => setFlowDescription(e.target.value)} placeholder="Add a description…" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Trigger selector */}
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger className="h-8 text-xs w-40 sm:w-44">
                <Zap className="w-3 h-3 mr-1 text-yellow-500 flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Keyword tags for keyword_matched trigger */}
            {trigger === 'keyword_matched' && (
              <div className="flex items-center gap-1 flex-wrap max-w-xs">
                {triggerKeywords.map((kw, i) => (
                  <span key={i} className="flex items-center gap-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full px-2 py-0.5 border border-yellow-200">
                    <Hash className="w-2.5 h-2.5" />{kw}
                    <button onClick={() => setTriggerKeywords((k) => k.filter((_, j) => j !== i))} className="ml-0.5 hover:text-red-600 font-bold">×</button>
                  </span>
                ))}
                <Input
                  className="h-6 text-xs w-20 rounded-full"
                  placeholder="+ keyword"
                  value={kwInput}
                  onChange={(e) => setKwInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                  onBlur={addKeyword}
                />
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => { setTestRan(false); setTestSteps([]); setShowTest(true); }}>
              <Play className="w-3.5 h-3.5 mr-1.5 text-green-600" />Test
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setShowProperties(true)}>
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            nodeTypes={nodeTypes} fitView
            className="bg-muted/20"
            defaultEdgeOptions={{ animated: true, style: { stroke: '#94a3b8' } }}
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls className="!border-border !shadow-sm" />
            <MiniMap className="!border-border !shadow-sm hidden sm:block"
              nodeColor={(n) => {
                if (n.type === 'start') return '#22c55e';
                if (n.type === 'end') return '#ef4444';
                if (n.type === 'condition') return '#a855f7';
                return '#3b82f6';
              }} />
          </ReactFlow>
        </div>
      </div>

      {/* Right properties desktop */}
      <div className="hidden lg:flex w-72 border-l bg-background flex-col">
        {propertiesContent}
      </div>

      {/* Test Flow dialog */}
      <Dialog open={showTest} onOpenChange={setShowTest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-4 h-4 text-green-600" />Test Flow Simulation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Simulate incoming message</Label>
              <div className="flex gap-2">
                <Input placeholder="e.g. I want pricing info" value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runTest(); }} />
                <Button onClick={runTest} size="sm">Run</Button>
              </div>
            </div>

            {testRan && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground">{testSteps.length} steps executed:</p>
                {testSteps.map((step, i) => (
                  <div key={i} className={cn(
                    'flex items-start gap-2.5 rounded-lg border p-2.5 text-xs',
                    step.result === 'executed' ? 'border-green-200 bg-green-50' :
                    step.result === 'branch_yes' ? 'border-green-200 bg-green-50' :
                    step.result === 'branch_no' ? 'border-orange-200 bg-orange-50' :
                    step.result === 'end' ? 'border-gray-200 bg-gray-50' :
                    'border-yellow-200 bg-yellow-50',
                  )}>
                    <div className="flex-shrink-0 mt-0.5">
                      {step.result === 'executed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                      {step.result === 'branch_yes' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                      {step.result === 'branch_no' && <AlertCircle className="w-3.5 h-3.5 text-orange-500" />}
                      {step.result === 'end' && <XCircle className="w-3.5 h-3.5 text-gray-500" />}
                      {step.result === 'skipped' && <SkipForward className="w-3.5 h-3.5 text-yellow-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{step.label}</p>
                      {step.detail && <p className="text-muted-foreground mt-0.5 break-words">{step.detail}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      {step.result === 'branch_yes' ? 'YES' : step.result === 'branch_no' ? 'NO' : step.result}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
