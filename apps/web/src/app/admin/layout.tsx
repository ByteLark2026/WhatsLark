'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, Shield, LogOut, MessageSquare, Menu,
  Radio, Megaphone, FileText, Contact, BarChart3, Bell, CreditCard, Layers,
  Receipt, Wallet, LifeBuoy, Smartphone,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { createClient } from '@/lib/supabase';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/channels', label: 'Channels', icon: Radio },
  { href: '/admin/campaigns', label: 'Master Campaigns', icon: Megaphone },
  { href: '/admin/templates', label: 'Master Templates', icon: FileText },
  { href: '/admin/contacts', label: 'Master Contacts', icon: Contact },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/subscription-plans', label: 'Subscription Plans', icon: CreditCard },
  { href: '/admin/subscriptions', label: 'Subscriptions Data', icon: Layers },
  { href: '/admin/transactions', label: 'Transactions Logs', icon: Receipt },
  { href: '/admin/message-logs', label: 'Message Logs', icon: MessageSquare },
  { href: '/admin/payment-gateway', label: 'Payment Gateway', icon: Wallet },
  { href: '/admin/support-tickets', label: 'Support Tickets', icon: LifeBuoy },
  { href: '/admin/app-update', label: 'App Update', icon: Smartphone },
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

  const initials = (user.full_name || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navContent = (
    <>
      <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
        <Shield className="w-5 h-5 text-red-400" />
        <div>
          <p className="text-sm font-bold">Super Admin</p>
          <p className="text-[10px] text-white/50">WhatsLark</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {adminNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileNavOpen(false)}
            className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname === href ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}
          >
            <Icon className="w-4 h-4 shrink-0" />{label}
          </Link>
        ))}
      </nav>
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
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base truncate">WhatsLark</span>
              <span className="hidden sm:inline text-xs text-muted-foreground">Admin</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium leading-none truncate max-w-[140px]">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="sm:hidden">
                <p className="text-sm font-medium truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground font-normal truncate">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                <MessageSquare className="w-4 h-4 mr-2" />Back to app
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <Toaster />
    </div>
  );
}
