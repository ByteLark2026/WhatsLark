'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Target, Award, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useRouter } from 'next/navigation';

interface StageData {
  stage: string;
  name: string;
  probability: number;
  color: string;
  count: number;
  total_value: number;
  weighted_value: number;
}

interface Lead {
  id: string;
  title: string;
  stage: string;
  score: number;
  score_grade: string;
  deal_value: number;
  currency: string;
  expected_close_date?: string;
  contacts?: { name?: string; phone?: string };
  users?: { full_name?: string };
}

const GRADE_STYLES: Record<string, string> = {
  hot: 'bg-red-100 text-red-700 border-red-200',
  warm: 'bg-orange-100 text-orange-700 border-orange-200',
  cold: 'bg-blue-100 text-blue-700 border-blue-200',
  dead: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function PipelinePage() {
  const router = useRouter();
  const [forecast, setForecast] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<any>('/leads/forecast'),
      api.get<any>('/leads/board'),
    ]).then(([fc, board]) => {
      setForecast(fc);
      const all: Lead[] = Object.values(board || {}).flat() as Lead[];
      setLeads(all);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fmt = (n: number, currency = '') =>
    `${currency ? currency + ' ' : ''}${n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n}`;

  const filteredLeads = selectedStage ? leads.filter((l) => l.stage === selectedStage) : leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost');

  if (loading) {
    return (
      <div>
        <Header title="Pipeline" subtitle="Sales pipeline & forecasting" />
        <div className="p-6 grid gap-4"><div className="h-64 bg-muted animate-pulse rounded-xl" /></div>
      </div>
    );
  }

  const activeStages = (forecast?.by_stage || []).filter((s: StageData) => s.stage !== 'won' && s.stage !== 'lost');
  const totalActive = activeStages.reduce((s: number, st: StageData) => s + st.total_value, 0);

  return (
    <div>
      <Header title="Pipeline" subtitle="Sales pipeline & revenue forecasting" />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Pipeline', value: fmt(forecast?.total_pipeline || 0), icon: TrendingUp, color: 'text-blue-600' },
            { label: 'Weighted Forecast', value: fmt(forecast?.weighted_forecast || 0), icon: Target, color: 'text-purple-600' },
            { label: 'Win Rate', value: `${forecast?.win_rate || 0}%`, icon: Award, color: 'text-green-600' },
            { label: 'Won This Month', value: fmt(forecast?.won_this_month || 0), icon: DollarSign, color: 'text-orange-600' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <s.icon className={cn('w-4 h-4', s.color)} />
                </div>
                <p className="text-xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Stage breakdown */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Pipeline by Stage</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(forecast?.by_stage || []).map((stage: StageData) => (
                  <button
                    key={stage.stage}
                    onClick={() => setSelectedStage(selectedStage === stage.stage ? null : stage.stage)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors',
                      selectedStage === stage.stage ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="text-sm font-medium">{stage.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1">{stage.probability}%</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{fmt(stage.total_value)}</p>
                        <p className="text-xs text-muted-foreground">{fmt(stage.weighted_value)} weighted · {stage.count} deals</p>
                      </div>
                    </div>
                    <Progress
                      value={totalActive > 0 ? (stage.total_value / totalActive) * 100 : 0}
                      className="h-1.5"
                      style={{ '--progress-color': stage.color } as any}
                    />
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Bar chart */}
            {forecast?.by_stage?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Weighted Revenue by Stage</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={forecast.by_stage.filter((s: StageData) => s.stage !== 'lost')} barSize={28}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                      <Tooltip formatter={(v: number) => [fmt(v), 'Weighted']} labelFormatter={(l) => l} />
                      <Bar dataKey="weighted_value" radius={[4, 4, 0, 0]}>
                        {forecast.by_stage.filter((s: StageData) => s.stage !== 'lost').map((s: StageData) => (
                          <Cell key={s.stage} fill={s.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Deals list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {selectedStage ? `${forecast?.by_stage?.find((s: StageData) => s.stage === selectedStage)?.name || selectedStage} Deals` : 'Active Deals'}
              </h2>
              {selectedStage && (
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedStage(null)}>Clear filter</button>
              )}
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No deals in this stage</p>
              ) : (
                filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="border rounded-lg p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push('/leads')}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium line-clamp-1">{lead.title}</p>
                      <Badge className={cn('text-[10px] shrink-0 border', GRADE_STYLES[lead.score_grade] || GRADE_STYLES.cold)}>
                        {lead.score_grade}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{lead.contacts?.name || 'No contact'}</p>
                      <p className="text-sm font-semibold text-green-700">
                        {lead.deal_value ? fmt(lead.deal_value, lead.currency) : '—'}
                      </p>
                    </div>
                    {lead.expected_close_date && (
                      <p className="text-xs text-muted-foreground mt-0.5">Close: {new Date(lead.expected_close_date).toLocaleDateString()}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
