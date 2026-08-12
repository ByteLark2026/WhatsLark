import Link from 'next/link';
import { MessageSquare, CheckCircle, ArrowRight, Zap, Users, BarChart3, Bot, Shield, Globe, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  { icon: MessageSquare, title: 'Team Inbox', desc: 'Manage all WhatsApp conversations in one shared inbox. Assign, tag, and track every chat.' },
  { icon: Users, title: 'Contacts CRM', desc: 'Build rich customer profiles with tags, custom fields, and full conversation history.' },
  { icon: BarChart3, title: 'Campaigns', desc: 'Send broadcast messages to thousands of contacts using approved WhatsApp templates.' },
  { icon: Zap, title: 'Automations', desc: 'Create rule-based workflows to auto-reply, assign agents, and tag conversations.' },
  { icon: Bot, title: 'AI Assistant', desc: 'GPT-powered auto-replies with human handover — so no lead goes unanswered.' },
  { icon: Shield, title: 'Multi-tenant & Secure', desc: 'Each workspace is isolated with row-level security. Enterprise-ready from day one.' },
];

// Fallback shown only if the API is unreachable — the real source of truth is
// the subscription_plans table, managed in Admin > Subscription Plans.
const FALLBACK_PLANS = [
  {
    name: 'Starter', price: '$29', period: '/month',
    features: ['2 agents', '1 WhatsApp number', '1,000 contacts', '5 campaigns/month', 'Basic automations'],
    cta: 'Start free trial', highlighted: false,
  },
  {
    name: 'Growth', price: '$79', period: '/month',
    features: ['10 agents', '3 WhatsApp numbers', '10,000 contacts', 'Unlimited campaigns', 'AI assistant', 'Analytics'],
    cta: 'Start free trial', highlighted: true,
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    features: ['Unlimited agents', 'Unlimited numbers', 'Unlimited contacts', 'Dedicated support', 'SLA', 'Custom integrations'],
    cta: 'Contact sales', highlighted: false,
  },
];

interface ApiPlan {
  id: string;
  name: string;
  price_monthly: number;
  currency: string;
  max_users: number | null;
  max_channels: number | null;
  max_contacts: number | null;
  max_messages_per_month: number | null;
  features: string[];
}

function planLimitLines(p: ApiPlan): string[] {
  const lines: string[] = [];
  lines.push(p.max_users ? `${p.max_users} agent${p.max_users === 1 ? '' : 's'}` : 'Unlimited agents');
  lines.push(p.max_channels ? `${p.max_channels} WhatsApp number${p.max_channels === 1 ? '' : 's'}` : 'Unlimited WhatsApp numbers');
  lines.push(p.max_contacts ? `${p.max_contacts.toLocaleString()} contacts` : 'Unlimited contacts');
  if (p.max_messages_per_month) lines.push(`${p.max_messages_per_month.toLocaleString()} messages/month`);
  return [...lines, ...(Array.isArray(p.features) ? p.features : [])];
}

async function getPlans() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/plans`, { next: { revalidate: 300 } }); // 5 min cache
    if (!res.ok) return FALLBACK_PLANS;
    const data: ApiPlan[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return FALLBACK_PLANS;

    return data.map((p, i) => ({
      name: p.name,
      price: p.price_monthly > 0
        ? new Intl.NumberFormat('en', { style: 'currency', currency: p.currency || 'USD', maximumFractionDigits: 0 }).format(p.price_monthly)
        : 'Custom',
      period: p.price_monthly > 0 ? '/month' : '',
      features: planLimitLines(p),
      cta: p.price_monthly > 0 ? 'Start free trial' : 'Contact sales',
      highlighted: data.length === 3 ? i === 1 : false,
    }));
  } catch {
    return FALLBACK_PLANS;
  }
}

export default async function HomePage() {
  const plans = await getPlans();
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="WhatsLark" className="h-9 w-auto object-contain" />
            <span className="text-xl font-bold">WhatsLark</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login"><Button variant="outline" size="sm">Sign in</Button></Link>
            <Link href="/register">
              <Button size="sm">
                <span className="hidden sm:inline">Start free trial</span>
                <span className="sm:hidden">Sign up</span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-16 sm:pt-24 pb-20 px-4 sm:px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5 gap-1.5">
            <Rocket className="w-3.5 h-3.5" /> Now in beta — join 2,000+ businesses
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            WhatsApp CRM for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#0F6FFF]">
              Sales &amp; Support
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Turn every WhatsApp conversation into a business opportunity. Manage leads, run campaigns, automate replies — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="px-8 gap-2">Start free trial <ArrowRight className="w-4 h-4" /></Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="px-8">View demo</Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">14-day free trial · No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to grow on WhatsApp</h2>
            <p className="text-lg text-muted-foreground">Built for sales teams, support teams, and marketers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">Start free. Scale as you grow.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`rounded-2xl border p-8 ${plan.highlighted ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'bg-white'}`}>
                {plan.highlighted && <Badge className="mb-4 text-xs">Most popular</Badge>}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full" variant={plan.highlighted ? 'default' : 'outline'}>{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-br from-[#0E1420] to-[#1a2a40] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <Globe className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to supercharge your WhatsApp?</h2>
          <p className="text-lg text-white/70 mb-8">Join thousands of businesses using WhatsLark to close more deals on WhatsApp.</p>
          <Link href="/register">
            <Button size="lg" className="px-10">Get started free <ArrowRight className="w-4 h-4 ml-2" /></Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="WhatsLark" className="h-7 w-auto object-contain" />
            <span className="font-semibold text-foreground">WhatsLark</span>
            <span>· WhatsApp CRM for Sales, Support &amp; Automation</span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
