'use client';

import { useEffect, useState, useCallback } from 'react';
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
  ChevronDown, Zap, Blocks, Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ---- Node type definitions ----
interface FlowNodeData {
  label: string;
  type: string;
  config?: Record<string, any>;
  [key: string]: unknown;
}

function BaseNode({ data, selected, color, icon: Icon, children }: {
  data: FlowNodeData;
  selected: boolean;
  color: string;
  icon: React.ComponentType<any>;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      'min-w-[160px] rounded-xl border-2 bg-white shadow-sm transition-shadow text-xs',
      selected ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50',
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !border-white !w-3 !h-3" />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${color}`}>
            <Icon className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{data.label}</span>
        </div>
        {children}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !border-white !w-3 !h-3" />
    </div>
  );
}

function StartNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  return (
    <div className={cn(
      'w-16 h-16 rounded-full border-4 flex items-center justify-center shadow-lg transition-all',
      selected ? 'border-primary' : 'border-green-500',
      'bg-green-500',
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-green-700 !border-white !w-3 !h-3" />
      <Zap className="w-6 h-6 text-white" />
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
    </BaseNode>
  ),
  template: (p: any) => (
    <BaseNode {...p} color="bg-green-500" icon={FileText}>
      {p.data.config?.template && <p className="text-gray-500 truncate">{p.data.config.template}</p>}
    </BaseNode>
  ),
  listMsg: (p: any) => <BaseNode {...p} color="bg-indigo-500" icon={List} />,
  media: (p: any) => <BaseNode {...p} color="bg-pink-500" icon={Image} />,
  location: (p: any) => <BaseNode {...p} color="bg-red-500" icon={MapPin} />,
  condition: (p: any) => (
    <BaseNode {...p} color="bg-purple-500" icon={GitBranch}>
      <Handle type="source" id="yes" position={Position.Left} className="!bg-green-500 !border-white !w-3 !h-3" style={{ top: '60%' }} />
      <Handle type="source" id="no" position={Position.Right} className="!bg-red-500 !border-white !w-3 !h-3" style={{ top: '60%' }} />
      {p.data.config?.condition && <p className="text-gray-500 truncate">{p.data.config.condition}</p>}
    </BaseNode>
  ),
  delay: (p: any) => (
    <BaseNode {...p} color="bg-gray-500" icon={Clock}>
      {p.data.config?.duration && <p className="text-gray-500">{p.data.config.duration}</p>}
    </BaseNode>
  ),
  variable: (p: any) => <BaseNode {...p} color="bg-cyan-500" icon={Variable} />,
  assign: (p: any) => <BaseNode {...p} color="bg-teal-500" icon={UserCheck} />,
  webhook: (p: any) => <BaseNode {...p} color="bg-orange-500" icon={Webhook} />,
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
  addGroup: (p: any) => <BaseNode {...p} color="bg-emerald-500" icon={UserPlus} />,
  update: (p: any) => <BaseNode {...p} color="bg-violet-500" icon={RefreshCw} />,
};

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

export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { company } = useAuthStore();

  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [trigger, setTrigger] = useState('message_received');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showProperties, setShowProperties] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!id || !company?.id) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('id', id)
        .eq('company_id', company.id)
        .single();
      if (data) {
        setFlowName(data.name);
        setTrigger(data.trigger);
        setFlowDescription(data.trigger_config?.description || '');
        const savedNodes = data.trigger_config?.nodes || [];
        const savedEdges = data.trigger_config?.edges || [];
        if (savedNodes.length === 0) {
          setNodes([{
            id: 'start',
            type: 'start',
            position: { x: 250, y: 80 },
            data: { label: 'START', type: 'start' },
          }]);
        } else {
          setNodes(savedNodes);
        }
        setEdges(savedEdges);
      }
      setLoading(false);
    })();
  }, [id, company?.id]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const addNode = (type: string, label: string) => {
    const newNode: Node<FlowNodeData> = {
      id: nextId(),
      type,
      position: { x: 100 + Math.random() * 200, y: 200 + nodes.length * 100 },
      data: { label, type, config: {} },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = async () => {
    if (!company?.id || !id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('automation_rules')
      .update({
        name: flowName,
        trigger,
        trigger_config: {
          description: flowDescription,
          runs: 0,
          nodes,
          edges,
        },
      })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Flow saved' });
    }
    setSaving(false);
  };

  const onNodeClick = useCallback((_: any, node: Node<FlowNodeData>) => {
    setSelectedNode(node);
    if (window.innerWidth < 1024) setShowProperties(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNodeConfig = (key: string, value: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
          : n
      )
    );
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, config: { ...prev.data.config, [key]: value } } } : prev
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const paletteContent = (
    <>
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground">Flow Nodes</p>
        <p className="text-xs text-muted-foreground">Click to add · hover ⓘ for help</p>
      </div>
      <div className="p-2 space-y-4 flex-1 overflow-y-auto">
        {PALETTE_NODES.map((group) => (
          <div key={group.category}>
            <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">{group.category}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {group.nodes.map((node) => (
                <button
                  key={node.type}
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

  const propertiesContent = (
    <>
      <div className="p-3 border-b flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
          <ChevronDown className="w-3.5 h-3.5 text-primary" />
        </div>
        <p className="text-xs font-semibold">Node Properties</p>
      </div>
      <div className="flex-1 p-3">
        {!selectedNode ? (
          <p className="text-xs text-muted-foreground mt-4 text-center">Click any node on the canvas to edit its settings</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-primary mb-2 capitalize">{selectedNode.data.type} Node</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Label</Label>
              <Input
                className="h-7 text-xs"
                value={selectedNode.data.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, label } } : n));
                  setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, label } } : prev);
                }}
              />
            </div>
            {selectedNode.data.type === 'sendMessage' && (
              <div className="space-y-2">
                <Label className="text-xs">Message</Label>
                <Textarea
                  className="text-xs resize-none"
                  rows={4}
                  placeholder="Type your message..."
                  value={selectedNode.data.config?.message || ''}
                  onChange={(e) => updateNodeConfig('message', e.target.value)}
                />
              </div>
            )}
            {selectedNode.data.type === 'askQuestion' && (
              <div className="space-y-2">
                <Label className="text-xs">Question</Label>
                <Textarea
                  className="text-xs resize-none"
                  rows={3}
                  placeholder="What do you want to ask?"
                  value={selectedNode.data.config?.question || ''}
                  onChange={(e) => updateNodeConfig('question', e.target.value)}
                />
                <Label className="text-xs">Save response to variable</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="e.g. user_name"
                  value={selectedNode.data.config?.variable || ''}
                  onChange={(e) => updateNodeConfig('variable', e.target.value)}
                />
              </div>
            )}
            {selectedNode.data.type === 'delay' && (
              <div className="space-y-2">
                <Label className="text-xs">Duration</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="e.g. 5 minutes"
                  value={selectedNode.data.config?.duration || ''}
                  onChange={(e) => updateNodeConfig('duration', e.target.value)}
                />
              </div>
            )}
            {selectedNode.data.type === 'condition' && (
              <div className="space-y-2">
                <Label className="text-xs">Condition</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="e.g. message contains 'yes'"
                  value={selectedNode.data.config?.condition || ''}
                  onChange={(e) => updateNodeConfig('condition', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Left handle = Yes, Right handle = No</p>
              </div>
            )}
            {selectedNode.data.type === 'webhook' && (
              <div className="space-y-2">
                <Label className="text-xs">Webhook URL</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="https://..."
                  value={selectedNode.data.config?.url || ''}
                  onChange={(e) => updateNodeConfig('url', e.target.value)}
                />
              </div>
            )}
            {selectedNode.data.type !== 'start' && selectedNode.data.type !== 'end' && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                  setSelectedNode(null);
                  setShowProperties(false);
                }}
              >
                Delete Node
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: Node Palette (desktop) */}
      <div className="hidden lg:flex w-52 border-r bg-background flex-col overflow-y-auto">
        {paletteContent}
      </div>

      {/* Left: Node Palette (mobile sheet) */}
      <Sheet open={showPalette} onOpenChange={setShowPalette}>
        <SheetContent side="left" className="w-64 max-w-[85vw] p-0 bg-background text-foreground flex flex-col">
          <SheetTitle className="sr-only">Flow nodes</SheetTitle>
          {paletteContent}
        </SheetContent>
      </Sheet>

      {/* Right: Node Properties (mobile sheet) */}
      <Sheet open={showProperties} onOpenChange={setShowProperties}>
        <SheetContent side="right" className="w-64 max-w-[85vw] p-0 bg-background text-foreground flex flex-col">
          <SheetTitle className="sr-only">Node properties</SheetTitle>
          {propertiesContent}
        </SheetContent>
      </Sheet>

      {/* Center: Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2.5 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={() => router.push('/automations')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setShowPalette(true)}>
            <Blocks className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-[120px]">
            <input
              className="font-semibold bg-transparent outline-none border-0 text-sm w-full"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Flow name..."
            />
            <input
              className="text-xs text-muted-foreground bg-transparent outline-none border-0 w-full"
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              placeholder="Add a description..."
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger className="h-8 text-xs w-40 sm:w-48">
                <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => {
              setNodes([{
                id: 'start',
                type: 'start',
                position: { x: 250, y: 80 },
                data: { label: 'START', type: 'start' },
              }]);
              setEdges([]);
            }}>
              New Flow
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save Flow
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setShowProperties(true)}>
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* React Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-muted/20"
            defaultEdgeOptions={{ animated: true, style: { stroke: '#94a3b8' } }}
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls className="!border-border !shadow-sm" />
            <MiniMap
              className="!border-border !shadow-sm hidden sm:block"
              nodeColor={(n) => {
                if (n.type === 'start') return '#22c55e';
                if (n.type === 'end') return '#ef4444';
                return '#3b82f6';
              }}
            />
          </ReactFlow>
        </div>
      </div>

      {/* Right: Node Properties (desktop) */}
      <div className="hidden lg:flex w-64 border-l bg-background flex-col overflow-y-auto">
        {propertiesContent}
      </div>
    </div>
  );
}
