'use client';

import { useEffect, useState } from 'react';
import { Plus, DollarSign, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { getInitials, formatCurrency, CURRENCIES } from '@/lib/utils';
import { LeadStage } from '@whatslark/shared';
import type { Lead, Contact } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

const STAGES: { stage: LeadStage; label: string; color: string; bg: string }[] = [
  { stage: LeadStage.NEW_LEAD, label: 'New Lead', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  { stage: LeadStage.QUALIFIED, label: 'Qualified', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  { stage: LeadStage.QUOTATION_SENT, label: 'Quotation Sent', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  { stage: LeadStage.NEGOTIATION, label: 'Negotiation', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  { stage: LeadStage.WON, label: 'Won', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  { stage: LeadStage.LOST, label: 'Lost', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
];

export default function LeadsPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', contact_id: '', stage: LeadStage.NEW_LEAD, deal_value: '', currency: 'USD', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, contact:contacts(id, name, phone)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) console.error(error);
      if (data) setLeads(data as unknown as Lead[]);
      setLoading(false);
    })();

    (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) setContacts(data as Contact[]);
    })();
  }, [company?.id]);

  const handleAdd = async () => {
    if (!company?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('leads')
      .insert({
        company_id: company.id,
        contact_id: form.contact_id,
        title: form.title,
        stage: form.stage,
        deal_value: form.deal_value ? parseFloat(form.deal_value) : null,
        currency: form.currency,
        notes: form.notes || null,
      })
      .select('*, contact:contacts(id, name, phone)')
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setLeads((prev) => [data as unknown as Lead, ...prev]);
      setShowAdd(false);
      setForm({ title: '', contact_id: '', stage: LeadStage.NEW_LEAD, deal_value: '', currency: 'USD', notes: '' });
      toast({ title: 'Lead created' });
    }
    setSaving(false);
  };

  const handleMoveStage = async (lead: Lead, stage: LeadStage) => {
    const supabase = createClient();
    const { error } = await supabase.from('leads').update({ stage }).eq('id', lead.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage } : l));
  };

  const byStage = (stage: LeadStage) => leads.filter((l) => l.stage === stage);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        title="Sales Pipeline"
        subtitle={`${leads.length} leads`}
        actions={<Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add lead</Button>}
      />

      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
        <div className="flex gap-4 min-w-max h-full">
          {STAGES.map(({ stage, label, color, bg }) => {
            const stageLeads = byStage(stage);
            const totalValue = stageLeads.reduce((acc, l) => acc + (l.deal_value || 0), 0);
            return (
              <div key={stage} className="w-64 sm:w-72 flex flex-col gap-2">
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${bg}`}>
                  <span className={`text-sm font-semibold ${color}`}>{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                    {totalValue > 0 && (
                      <span className="text-xs font-medium text-green-700">{formatCurrency(totalValue)}</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    [...Array(2)].map((_, i) => (
                      <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                    ))
                  ) : stageLeads.map((lead) => (
                    <Card key={lead.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{lead.title}</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1 shrink-0">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {STAGES.filter((s) => s.stage !== lead.stage).map((s) => (
                                <DropdownMenuItem key={s.stage} onClick={() => handleMoveStage(lead, s.stage)}>
                                  Move to {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {lead.contact && (
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {getInitials(lead.contact.name || lead.contact.phone)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {lead.contact.name || lead.contact.phone}
                            </span>
                          </div>
                        )}
                        {lead.deal_value && (
                          <div className="flex items-center gap-1 text-green-700">
                            <DollarSign className="w-3 h-3" />
                            <span className="text-sm font-semibold">{formatCurrency(lead.deal_value, lead.currency)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create lead</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="Deal title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact *</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name || c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as LeadStage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s.stage} value={s.stage}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Deal value</Label>
                <Input type="number" placeholder="0" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !form.title || !form.contact_id}>Create lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
