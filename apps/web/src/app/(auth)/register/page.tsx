'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import { createClient } from '@/lib/supabase';
import { UserRole } from '@whatslark/shared';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', company_name: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Create account via Next.js API route (uses service role server-side)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Registration failed');

      // Sign in with Supabase to get session cookies
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) throw new Error(error.message);

      // Fetch user profile + company
      const { data: profile } = await supabase
        .from('users')
        .select('*, company_users(company_id, role, companies(*))')
        .eq('id', data.user.id)
        .single();

      const companyUser = profile?.company_users?.[0];
      if (companyUser) {
        setAuth(profile, companyUser.companies, UserRole.OWNER, data.session!.access_token);
      }

      toast({ title: 'Workspace created!', description: 'Welcome to WhatsLark.' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-2 mb-8 lg:hidden">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <span className="text-xl font-bold">WhatsLark</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your workspace</CardTitle>
          <CardDescription>Start your 14-day free trial — no credit card required</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input placeholder="John Smith" required {...field('full_name')} />
            </div>
            <div className="space-y-2">
              <Label>Work email</Label>
              <Input type="email" placeholder="you@company.com" required {...field('email')} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Min 8 characters" minLength={8} required {...field('password')} />
            </div>
            <div className="space-y-2">
              <Label>Company / Workspace name</Label>
              <Input placeholder="Acme Corp" required {...field('company_name')} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create workspace
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By signing up you agree to our{' '}
            <Link href="/terms" className="text-primary hover:underline">Terms</Link>
            {' & '}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
