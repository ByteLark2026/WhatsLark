'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, MessageSquare, Megaphone, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface AdminStats {
  total_companies: number;
  active_companies: number;
  total_users: number;
  total_conversations: number;
  total_campaigns: number;
  plan_breakdown: Record<string, number>;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AdminStats>('/super-admin/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total Companies', value: stats?.total_companies ?? 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Companies', value: stats?.active_companies ?? 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total Conversations', value: stats?.total_conversations ?? 0, icon: MessageSquare, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Total Campaigns', value: stats?.total_campaigns ?? 0, icon: Megaphone, color: 'text-pink-600', bg: 'bg-pink-50' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground">Platform-wide statistics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? <span className="animate-pulse">—</span> : c.value.toLocaleString()}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <c.icon className={`w-6 h-6 ${c.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats?.plan_breakdown && (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-base">Companies by plan</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.plan_breakdown).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between text-sm">
                  <span className="capitalize font-medium">{plan}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
