'use client';

import { useState } from 'react';
import { Save, Loader2, Building2, Globe, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Jakarta', 'Asia/Bangkok',
  'Australia/Sydney', 'Pacific/Auckland',
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, company, setAuth, role } = useAuthStore();
  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || '', avatar_url: user?.avatar_url || '' });
  const [companyForm, setCompanyForm] = useState({ name: company?.name || '', timezone: company?.timezone || 'UTC' });
  const [saving, setSaving] = useState<string | null>(null);

  const saveProfile = async () => {
    setSaving('profile');
    try {
      const updated = await api.patch('/auth/profile', profileForm);
      toast({ title: 'Profile updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const saveCompany = async () => {
    setSaving('company');
    try {
      await api.patch('/companies/me', companyForm);
      toast({ title: 'Workspace updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <Header title="Settings" subtitle="Manage your profile and workspace" />
      <div className="p-6 max-w-3xl">
        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal info</CardTitle>
                <CardDescription>Update your name and profile picture</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <Button onClick={saveProfile} disabled={saving === 'profile'}>
                  {saving === 'profile' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspace">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="w-4 h-4" />Workspace</CardTitle>
                <CardDescription>Settings for your company workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Timezone</Label>
                  <Select value={companyForm.timezone} onValueChange={(v) => setCompanyForm({ ...companyForm, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground">Plan</p>
                  <p className="text-sm font-semibold capitalize">{company?.plan} {company?.status === 'trial' ? '(Trial)' : ''}</p>
                </div>
                <Button onClick={saveCompany} disabled={saving === 'company'}>
                  {saving === 'company' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save workspace
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change password</CardTitle>
                <CardDescription>Use the link below to reset your password via email</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={async () => {
                  await api.post('/auth/forgot-password', { email: user?.email });
                  toast({ title: 'Password reset email sent', description: 'Check your inbox.' });
                }}>
                  Send password reset email
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
