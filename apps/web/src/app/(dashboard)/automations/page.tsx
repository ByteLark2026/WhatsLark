'use client';

import { useEffect, useState } from 'react';
import { Plus, Zap, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { AutomationTrigger, AutomationAction } from '@whatslark/shared';
import type { AutomationRule } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  message_received: 'Message received',
  keyword_matched: 'Keyword matched',
  new_contact: 'New contact',
};

const ACTION_LABELS: Record<AutomationAction, string> = {
  send_message: 'Send message',
  assign_agent: 'Assign agent',
  add_tag: 'Add tag',
  create_lead: 'Create lead',
};

export default function AutomationsPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (!error && data) setRules(data as unknown as AutomationRule[]);
      setLoading(false);
    })();
  }, [company?.id]);

  const toggleRule = async (rule: AutomationRule) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('automation_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  };

  return (
    <div>
      <Header
        title="Automations"
        subtitle="Set rules to automate your workflow"
        actions={<Button size="sm"><Plus className="w-4 h-4 mr-2" />New automation</Button>}
      />
      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">No automations yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Automate repetitive tasks with rule-based triggers and actions.</p>
            <Button><Plus className="w-4 h-4 mr-2" />New automation</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        <span className="font-semibold">{rule.name}</span>
                        <Badge variant={rule.is_active ? 'success' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          WHEN: {TRIGGER_LABELS[rule.trigger]}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        {rule.actions.map((action, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-medium">
                            {ACTION_LABELS[action.type]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.is_active} onCheckedChange={() => toggleRule(rule)} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
