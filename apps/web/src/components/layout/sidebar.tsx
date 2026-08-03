'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MessageSquare, Users, TrendingUp, Megaphone,
  FileText, Zap, Bot, Phone, PhoneCall, UserCog, Settings, LogOut, ChevronDown,
  Shield, BarChart2, Code2, LifeBuoy, ShoppingBag, PieChart, Calendar, FormInput,
  Briefcase, Target, FolderKanban, Activity, Award, Receipt, FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { api } from '@/lib/api';
import { ChannelSwitcher } from './channel-switcher';

function CallAvailabilityToggle() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const next = !available;
    try {
      await api.patch('/voice/agents/availability', { is_available: next });
      setAvailable(next);
    } catch {
      // Voice calling not set up for this company — toggle silently stays off.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 text-sidebar-foreground/80">
      <div className="flex items-center gap-2 text-xs">
        <Phone className="w-3.5 h-3.5" />
        Available for calls
      </div>
      <Switch checked={available} onCheckedChange={toggle} disabled={loading} className="scale-90" />
    </div>
  );
}

const navSections = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/inbox', label: 'Inbox', icon: MessageSquare },
    ],
  },
  {
    label: 'Sales & CRM',
    items: [
      { href: '/contacts', label: 'Contacts', icon: Users },
      { href: '/leads', label: 'Leads', icon: TrendingUp },
      { href: '/leads/scoring', label: 'Lead Scoring', icon: Activity },
      { href: '/pipeline', label: 'Pipeline', icon: Target },
      { href: '/crm', label: 'CRM', icon: Briefcase },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/campaigns/schedule', label: 'Schedule', icon: Calendar },
      { href: '/templates', label: 'Templates', icon: FileText },
      { href: '/forms', label: 'Forms', icon: FormInput },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/quotes', label: 'Quotations', icon: FileCheck },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/automations', label: 'Automations', icon: Zap },
      { href: '/ecommerce', label: 'E-commerce', icon: ShoppingBag },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart2 },
      { href: '/reports', label: 'Reports', icon: PieChart },
      { href: '/team/performance', label: 'Performance', icon: Award },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/channels', label: 'Channels', icon: Phone },
      { href: '/settings/voice', label: 'Voice', icon: PhoneCall },
      { href: '/team', label: 'Team', icon: UserCog },
      { href: '/ai-bot', label: 'AI Bot', icon: Bot },
      { href: '/widget-builder', label: 'Widget Builder', icon: Code2 },
      { href: '/support', label: 'Support', icon: LifeBuoy },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, company, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/login');
  };

  return (
    <aside className={cn('flex flex-col w-64 min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border', className)}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-sidebar-border">
        <img src="/logo.png" alt="WhatsLark" className="h-10 w-auto object-contain" />
        {company && <p className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">{company.name}</p>}
      </div>

      {/* Channel switcher */}
      <ChannelSwitcher />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/leads' && pathname.startsWith(href + '/')) || (href === '/leads' && pathname === '/leads');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-white'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border">
        <CallAvailabilityToggle />
      </div>

      {/* User menu */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="bg-primary text-white text-xs">
                  {user ? getInitials(user.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.full_name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-sidebar-foreground/60 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user?.is_super_admin && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/admin"><Shield className="w-4 h-4 mr-2" />Super Admin</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href="/settings"><Settings className="w-4 h-4 mr-2" />Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
