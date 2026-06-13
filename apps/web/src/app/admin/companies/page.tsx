'use client';

import { useEffect, useState } from 'react';
import { Search, MoreHorizontal, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CompanyStatus } from '@whatslark/shared';
import type { Company } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

export default function AdminCompaniesPage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<{ data: Company[] }>('/admin/companies')
      .then((res) => setCompanies(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (company: Company, status: Company['status']) => {
    try {
      await api.patch(`/admin/companies/${company.id}/status`, { status });
      setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, status } : c));
      toast({ title: `Company ${status}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.slug.includes(q);
  });

  const statusVariant = { active: 'success', suspended: 'destructive', trial: 'warning' } as any;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground">{companies.length} total workspaces</p>
        </div>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search companies…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : filtered.map((company) => (
              <tr key={company.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.slug}</p>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{company.plan}</Badge></td>
                <td className="px-4 py-3"><Badge variant={statusVariant[company.status]} className="capitalize">{company.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(company.created_at)}</td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View details</DropdownMenuItem>
                      {company.status !== CompanyStatus.ACTIVE && (
                        <DropdownMenuItem onClick={() => handleStatusChange(company, CompanyStatus.ACTIVE)}>
                          <CheckCircle className="w-4 h-4 mr-2 text-green-600" />Activate
                        </DropdownMenuItem>
                      )}
                      {company.status !== CompanyStatus.SUSPENDED && (
                        <DropdownMenuItem onClick={() => handleStatusChange(company, CompanyStatus.SUSPENDED)} className="text-destructive focus:text-destructive">
                          <XCircle className="w-4 h-4 mr-2" />Suspend
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
