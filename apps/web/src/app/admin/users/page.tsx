'use client';

import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { User, CompanyUser } from '@whatslark/shared';
import { AdminPagination } from '@/components/admin/pagination';

type AdminUser = User & { company_users?: (CompanyUser & { companies?: { name: string; slug: string } | { name: string; slug: string }[] })[] };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    api.get<{ data: AdminUser[]; total: number; page: number; limit: number }>(`/admin/users?page=${page}&limit=${limit}`)
      .then((res) => { setUsers(res.data); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const companyNames = (u: AdminUser) => {
    const list = u.company_users || [];
    return list.flatMap((cu) => {
      const c = cu.companies;
      if (!c) return [];
      return Array.isArray(c) ? c.map((x) => x.name) : [c.name];
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} total users across all companies</p>
        </div>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Companies</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Super Admin</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                </tr>
              ))
            ) : filtered.map((u) => (
              <tr key={u.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {companyNames(u).length === 0 ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : companyNames(u).map((name, i) => (
                      <Badge key={i} variant="outline">{name}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.is_super_admin ? (
                    <Badge variant="destructive" className="gap-1"><ShieldCheck className="w-3 h-3" />Admin</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} limit={limit} total={total} onPageChange={setPage} />
    </div>
  );
}
