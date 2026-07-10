'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Submission {
  id: string;
  data: Record<string, any>;
  contact_id: string | null;
  lead_id: string | null;
  ip_address: string | null;
  submitted_at: string;
}

export default function SubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formTitle, setFormTitle] = useState('Form');

  useEffect(() => {
    Promise.all([
      api.get<any>(`/forms/${id}`),
      api.get<any>(`/forms/${id}/submissions`),
    ]).then(([form, res]) => {
      setFormTitle(form?.title || 'Form');
      setSubmissions(res?.data || []);
      setTotal(res?.total || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const exportCsv = () => {
    if (!submissions.length) return;
    const keys = Array.from(new Set(submissions.flatMap((s) => Object.keys(s.data))));
    const header = ['submitted_at', ...keys, 'contact_created', 'lead_created'].join(',');
    const rows = submissions.map((s) => [
      s.submitted_at,
      ...keys.map((k) => `"${(s.data[k] || '').toString().replace(/"/g, '""')}"`),
      s.contact_id ? 'yes' : 'no',
      s.lead_id ? 'yes' : 'no',
    ].join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${formTitle}-submissions.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const allKeys = Array.from(new Set(submissions.flatMap((s) => Object.keys(s.data))));

  return (
    <div>
      <Header
        title={`${formTitle} — Submissions`}
        subtitle={`${total} total submissions`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/forms/${id}`)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back to builder
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!submissions.length}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Export CSV
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No submissions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                  {allKeys.map((k) => (
                    <th key={k} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</th>
                  ))}
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Contact</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.submitted_at)}</td>
                    {allKeys.map((k) => (
                      <td key={k} className="py-2.5 px-3 max-w-[180px] truncate">{s.data[k] || '—'}</td>
                    ))}
                    <td className="py-2.5 px-3">
                      <Badge variant={s.contact_id ? 'success' : 'outline'} className="text-[10px]">{s.contact_id ? 'Created' : 'None'}</Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant={s.lead_id ? 'success' : 'outline'} className="text-[10px]">{s.lead_id ? 'Created' : 'None'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
