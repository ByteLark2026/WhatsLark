'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, PhoneCall, MessageSquare, Loader2, DollarSign, Calendar } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase';
import { getInitials, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTwilioDevice } from '@/hooks/use-twilio-device';
import { ActivityTimeline } from '@/components/activity-timeline';

interface LeadDetail {
  id: string;
  title: string;
  stage: string;
  deal_value?: number;
  currency?: string;
  expected_close_date?: string;
  score?: number;
  score_grade?: string;
  contacts?: { id: string; name?: string; phone: string; email?: string };
  users?: { full_name?: string };
}

const STAGE_VARIANT: Record<string, any> = {
  new_lead: 'secondary', qualified: 'default', quotation_sent: 'warning',
  negotiation: 'warning', won: 'success', lost: 'destructive',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { makeCall } = useTwilioDevice();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<LeadDetail>(`/leads/${id}`)
      .then(setLead)
      .finally(() => setLoading(false));
  }, [id]);

  const handleMessage = async () => {
    if (!lead?.contacts) return;
    setMessaging(true);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', lead.contacts.id)
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        window.location.href = `/inbox?conversation=${existing.id}`;
      } else {
        toast({ title: 'No open conversation', description: 'Message this contact from the Inbox to start one.' });
      }
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) return <div className="p-4 sm:p-6 text-muted-foreground">Lead not found</div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Link href="/leads">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Avatar className="w-14 h-14 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {getInitials(lead.contacts?.name || lead.title)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{lead.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-muted-foreground">{lead.contacts?.name || lead.contacts?.phone}</p>
              <Badge variant={STAGE_VARIANT[lead.stage] || 'secondary'}>{lead.stage.replace('_', ' ')}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={!lead.contacts?.phone}
            onClick={() => lead.contacts?.phone && makeCall(lead.contacts.phone, { contact_id: lead.contacts.id, lead_id: lead.id }).catch((err: any) =>
              toast({ title: 'Call failed', description: err.message, variant: 'destructive' }))}
          >
            <PhoneCall className="w-4 h-4 mr-2" />Call
          </Button>
          <Button onClick={handleMessage} disabled={messaging} className="flex-1 sm:flex-none">
            {messaging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
            Message
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lead.deal_value != null && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                {lead.currency || 'USD'} {lead.deal_value.toLocaleString()}
              </div>
            )}
            {lead.expected_close_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Expected close: {formatDate(lead.expected_close_date)}
              </div>
            )}
            {lead.score != null && (
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-sm font-medium">{lead.score} ({lead.score_grade})</p>
              </div>
            )}
            {lead.users?.full_name && (
              <div>
                <p className="text-xs text-muted-foreground">Assigned to</p>
                <p className="text-sm font-medium">{lead.users.full_name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lead.contacts ? (
              <>
                <p className="text-sm font-medium">{lead.contacts.name || 'Unnamed'}</p>
                <p className="text-sm text-muted-foreground">{lead.contacts.phone}</p>
                {lead.contacts.email && <p className="text-sm text-muted-foreground">{lead.contacts.email}</p>}
                <Link href={`/contacts/${lead.contacts.id}`} className="text-xs text-primary hover:underline inline-block mt-1">
                  View full contact →
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No linked contact</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-sm mb-3">Activity</h2>
        <ActivityTimeline leadId={lead.id} />
      </div>
    </div>
  );
}
