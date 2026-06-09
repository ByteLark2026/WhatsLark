'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MessageSquare, Users, TrendingUp, Megaphone,
  FileText, Zap, Bot, Phone, UserCog, Settings, LogOut, ChevronDown,
  Shield, BarChart2, Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/leads', label: 'Leads', icon: TrendingUp },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/automations', label: 'Automations', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/widget-builder', label: 'Widget Builder', icon: Code2 },
  { href: '/ai-bot', label: 'AI Bot', icon: Bot },
  { href: '/channels', label: 'Channels', icon: Phone },
  { href: '/team', label: 'Team', icon: UserCog },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
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
    <aside className="flex flex-col w-64 min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-bold text-white text-lg leading-none">WhatsLark</span>
          {company && <p className="text-xs text-sidebar-foreground/60 truncate max-w-[120px]">{company.name}</p>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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
      </nav>

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
