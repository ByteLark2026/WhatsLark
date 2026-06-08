'use client';

import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
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
  const [members, setMembers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: UserRole.AGENT });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<CompanyUser[]>('/users')
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async () => {
    setSaving(true);
    try {
      const member = await api.post<CompanyUser>('/users/invite', form);
      setMembers((prev) => [...prev, member]);
      setShowInvite(false);
      toast({ title: 'Invitation sent', description: `Invite sent to ${form.email}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
                        <DropdownMenuItem>Change role</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">Remove</DropdownMenuItem>
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
            <Button onClick={handleInvite} disabled={saving || !form.email}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
