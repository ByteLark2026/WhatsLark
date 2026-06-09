'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/auth';
import { createClient } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
        return;
      }

      // Populate store if it's empty (e.g. after page refresh or first load)
      if (!user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*, company_users(company_id, role, companies(*))')
          .eq('id', session.user.id)
          .single();

        const companyUser = profile?.company_users?.[0];
        if (profile && companyUser) {
          setAuth(profile, companyUser.companies, companyUser.role, session.access_token);
          localStorage.setItem('sb-token', JSON.stringify({ access_token: session.access_token }));
        }
      }

      setChecking(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
