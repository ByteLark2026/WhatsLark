'use client';

import { useEffect, useState } from 'react';
import { Flame, TrendingUp, BarChart2, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn, getInitials } from '@/lib/utils';

const GRADE_STYLES: Record<string, { label: string; className: string }> = {
  hot:  { label: '🔥 Hot',  className: 'bg-red-100 text-red-700 border-red-200' },
  warm: { label: '☀️ Warm', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  cold: { label: '❄️ Cold', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  dead: { label: '💀 Dead', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

interface ScoredLead {
  id: string;
  title: string;
  score: number;
  score_grade: string;
  stage: string;
  deal_value?: number;
  currency?: string;
  contacts?: { name?: string; avatar_url?: string };
  users?: { full_name?: string };
}

interface Rule {
  id: string;
  name: string;
  event_type: string;
  points: number;
  is_active: boolean;
}

export default function LeadScoringPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [gradeFilter, setGradeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', event_type: 'deal_value', points: 10 });

  const load = async (grade = '') => {
    const [l, r] = await Promise.allSettled([
      api.get<any>(`/scoring/leads${grade ? `?grade=${grade}` : ''}`),
      api.get<Rule[]>('/scoring/rules'),
    ]);
    if (l.status === 'fulfilled') setLeads(l.value?.data || []);
    if (r.status === 'fulfilled') setRules(r.value || []);
    setLoading(false);
  };

  useEffect(() => { load(gradeFilter); }, [gradeFilter]);

  const recalculate = async () => {
    setRecalcLoading(true);
    try {
      const res = await api.post<any>('/scoring/recalculate');
      toast({ title: `Scores updated for ${res.updated} leads` });
      load(gradeFilter);
    } catch {}
    setRecalcLoading(false);
  };

  const addRule = async () => {
    try {
      await api.post('/scoring/rules', ruleForm);
      setRuleDialog(false);
      setRuleForm({ name: '', event_type: 'deal_value', points: 10 });
      load(gradeFilter);
      toast({ title: 'Rule added' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteRule = async (id: string) => {
    await api.delete(`/scoring/rules/${id}`);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const gradeCounts = leads.reduce((acc, l) => {
    acc[l.score_grade] = (acc[l.score_grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <Header
        title="Lead Scoring"
        subtitle="Prioritize deals by score & grade"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={recalculate} disabled={recalcLoading}>
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', recalcLoading && 'animate-spin')} />
              Recalculate
            </Button>
            <Button size="sm" onClick={() => setRuleDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Rule
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Grade distribution */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(GRADE_STYLES).map(([grade, style]) => (
            <button
              key={grade}
              onClick={() => setGradeFilter(gradeFilter === grade ? '' : grade)}
              className={cn(
                'border rounded-xl p-4 text-left transition-all',
                gradeFilter === grade ? 'ring-2 ring-primary' : 'hover:shadow-sm',
                style.className
              )}
            >
              <p className="text-lg font-bold">{gradeCounts[grade] || 0}</p>
              <p className="text-sm font-medium">{style.label}</p>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Leads table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {gradeFilter ? `${GRADE_STYLES[gradeFilter]?.label} Leads` : 'All Leads'}
                  </CardTitle>
                  {gradeFilter && (
                    <button className="text-xs text-muted-foreground" onClick={() => setGradeFilter('')}>Clear</button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}</div>
                ) : leads.length === 0 ? (
                  <p className="text-sm text-center py-8 text-muted-foreground">No leads found. Click Recalculate to score existing leads.</p>
                ) : (
                  <div className="space-y-2">
                    {leads.map((lead) => (
                      <div key={lead.id} className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-muted/30">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 border', GRADE_STYLES[lead.score_grade]?.className)}>
                          {lead.score}
                        </div>
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarImage src={lead.contacts?.avatar_url} />
                          <AvatarFallback className="text-[10px] bg-primary text-white">
                            {getInitials(lead.contacts?.name || lead.title)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lead.title}</p>
                          <p className="text-xs text-muted-foreground">{lead.contacts?.name || ''} · {lead.stage.replace('_', ' ')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge className={cn('text-[10px] border', GRADE_STYLES[lead.score_grade]?.className)}>
                            {GRADE_STYLES[lead.score_grade]?.label}
                          </Badge>
                          {lead.deal_value ? (
                            <p className="text-xs font-medium mt-0.5">{lead.currency || ''} {lead.deal_value.toLocaleString()}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rules */}
          <div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Scoring Rules</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Built-in formula</p>
                  <p>Stage position: 5–50 pts</p>
                  <p>Deal value: 5–40 pts</p>
                  <p>Has email: +5 pts</p>
                  <p>Has notes: +5 pts</p>
                  <p className="pt-1 font-medium text-foreground">Grades: Hot ≥70, Warm ≥40, Cold ≥15, Dead &lt;15</p>
                </div>

                {rules.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Custom rules</p>
                    {rules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">{rule.event_type} · {rule.points} pts</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => deleteRule(rule.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setRuleDialog(true)}>
                  <Plus className="w-3 h-3 mr-1.5" />Add custom rule
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Scoring Rule</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Rule name</Label>
              <Input value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. High-value deal bonus" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select value={ruleForm.event_type} onValueChange={(v) => setRuleForm((f) => ({ ...f, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deal_value">Deal value threshold</SelectItem>
                  <SelectItem value="stage">Stage reached</SelectItem>
                  <SelectItem value="has_email">Has email address</SelectItem>
                  <SelectItem value="has_close_date">Has close date</SelectItem>
                  <SelectItem value="manual">Manual boost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Points (+/-)</Label>
              <Input type="number" value={ruleForm.points} onChange={(e) => setRuleForm((f) => ({ ...f, points: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(false)}>Cancel</Button>
            <Button onClick={addRule} disabled={!ruleForm.name.trim()}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
