'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, Shield, LogOut, MessageSquare, Menu } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { createClient } from '@/lib/supabase';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const adminNav = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const navContent = (
    <>
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
            onClick={() => setMobileNavOpen(false)}
            className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname === href ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}
          >
            <Icon className="w-4 h-4" />{label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors">
          <MessageSquare className="w-4 h-4" />Back to app
        </Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition-colors">
          <LogOut className="w-4 h-4" />Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex flex-col w-56 bg-[#0E1420] text-white border-r border-white/10">
        {navContent}
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-56 max-w-[80vw] p-0 bg-[#0E1420] text-white flex flex-col border-r-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          {navContent}
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            <span className="font-bold text-sm">Super Admin</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <Toaster />
    </div>
  );
}
