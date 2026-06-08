'use client';

import { useEffect, useState } from 'react';
import { Plus, Send, Users, CheckCheck, Eye, XCircle, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CampaignStatus } from '@whatslark/shared';
import type { Campaign } from '@whatslark/shared';
import Link from 'next/link';

const statusBadge: Record<CampaignStatus, { label: string; variant: any }> = {
  draft: { label: 'Draft', variant: 'outline' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  running: { label: 'Running', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  paused: { label: 'Paused', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Campaign[]>('/campaigns')
      .then(setCampaigns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Header
        title="Campaigns"
        subtitle="Broadcast messages to your contacts"
        actions={
          <Link href="/campaigns/new">
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />New campaign</Button>
          </Link>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No campaigns yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">Create your first broadcast campaign to reach customers on WhatsApp.</p>
            <Link href="/campaigns/new">
              <Button><Plus className="w-4 h-4 mr-2" />New campaign</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const badge = statusBadge[campaign.status];
              const deliveryRate = campaign.sent_count > 0
                ? Math.round((campaign.delivered_count / campaign.sent_count) * 100)
                : 0;
              const readRate = campaign.delivered_count > 0
                ? Math.round((campaign.read_count / campaign.delivered_count) * 100)
                : 0;

              return (
                <Card key={campaign.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold truncate">{campaign.name}</h3>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        {campaign.scheduled_at && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Scheduled: {formatDate(campaign.scheduled_at, { dateStyle: 'medium', timeStyle: 'short' } as any)}
                          </p>
                        )}
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span>{campaign.total_recipients.toLocaleString()} recipients</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Send className="w-3.5 h-3.5" />
                            <span>{campaign.sent_count} sent</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-green-700">
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>{deliveryRate}% delivered</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-blue-700">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{readRate}% read</span>
                          </div>
                          {campaign.failed_count > 0 && (
                            <div className="flex items-center gap-1.5 text-destructive">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{campaign.failed_count} failed</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View details</DropdownMenuItem>
                          {campaign.status === 'draft' && <DropdownMenuItem>Edit</DropdownMenuItem>}
                          {campaign.status === 'running' && <DropdownMenuItem>Pause</DropdownMenuItem>}
                          <DropdownMenuItem className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
