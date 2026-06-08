'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, Shield, LogOut, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { createClient } from '@/lib/supabase';

const adminNav = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (!user.is_super_admin) { router.push('/dashboard'); }
  }, [user, router]);

  if (!user?.is_super_admin) return null;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex flex-col w-56 bg-[#0E1420] text-white border-r border-white/10">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
          <Shield className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-sm font-bold">Super Admin</p>
            <p className="text-[10px] text-white/50">WhatsLark</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {adminNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
                pathname === href ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}
            >
              <Icon className="w-4 h-4" />{label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-white/10 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors">
            <MessageSquare className="w-4 h-4" />Back to app
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition-colors">
            <LogOut className="w-4 h-4" />Log out
          </button>
        </div>
      </aside>
      <div className="flex-1 overflow-y-auto">{children}</div>
      <Toaster />
    </div>
  );
}
