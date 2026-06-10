'use client';

import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@whatslark/shared';
import type { CompanyUser } from '@whatslark/shared';
import { getInitials, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const roleBadge: Record<UserRole, any> = {
  owner: 'info',
  admin: 'warning',
  manager: 'secondary',
  agent: 'outline',
};

export default function TeamPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [members, setMembers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: UserRole.AGENT });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from('company_users')
        .select('*, user:users(*)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: true });
      if (error) console.error(error);
      if (data) setMembers(data as unknown as CompanyUser[]);
      setLoading(false);
    })();
  }, [company?.id]);

  const handleInvite = async () => {
    if (!company?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, company_id: company.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invite failed');
      setMembers((prev) => [...prev, data as CompanyUser]);
      setShowInvite(false);
      setForm({ email: '', full_name: '', role: UserRole.AGENT });
      toast({ title: 'Invitation sent', description: `Invite sent to ${form.email}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (member: CompanyUser, role: UserRole) => {
    const supabase = createClient();
    const { error } = await supabase.from('company_users').update({ role }).eq('id', member.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role } : m));
    toast({ title: 'Role updated' });
  };

  const handleToggleActive = async (member: CompanyUser) => {
    const supabase = createClient();
    const next = !member.is_active;
    const { error } = await supabase.from('company_users').update({ is_active: next }).eq('id', member.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, is_active: next } : m));
    toast({ title: next ? 'Member reactivated' : 'Member removed' });
  };

  return (
    <div>
      <Header
        title="Team"
        subtitle="Manage your workspace members"
        actions={<Button size="sm" onClick={() => setShowInvite(true)}><Plus className="w-4 h-4 mr-2" />Invite member</Button>}
      />

      <div className="p-6">
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-12">No team members yet</td></tr>
              ) : members.map((member) => (
                <tr key={member.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.user?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(member.user?.full_name || member.user?.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{member.user?.full_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />{member.user?.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleBadge[member.role]} className="capitalize">{member.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={member.is_active ? 'success' : 'secondary'}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(member.created_at)}</td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {([UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT] as UserRole[])
                          .filter((r) => r !== member.role)
                          .map((r) => (
                            <DropdownMenuItem key={r} className="capitalize" onClick={() => handleChangeRole(member, r)}>
                              Make {r}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuItem
                          className={member.is_active ? 'text-destructive focus:text-destructive' : ''}
                          onClick={() => handleToggleActive(member)}
                        >
                          {member.is_active ? 'Remove' : 'Reactivate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="colleague@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input placeholder="Jane Smith" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                  <SelectItem value={UserRole.MANAGER}>Manager</SelectItem>
                  <SelectItem value={UserRole.AGENT}>Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving || !form.email}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
