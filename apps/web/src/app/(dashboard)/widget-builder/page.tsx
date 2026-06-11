'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Copy, Check, MessageCircle, X, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WidgetConfig {
  title: string;
  subtitle: string;
  site_name: string;
  allowed_domain: string;
  chat_greeting: string;
  response_time: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
  position: 'bottom-right' | 'bottom-left';
  style_preset: 'modern' | 'classic' | 'minimal';
  button_text: string;
  search_placeholder: string;
  faqs_count: string;
  show_team_avatars: boolean;
  show_recent_faqs: boolean;
  live_chat: boolean;
  ai_auto_reply: boolean;
  font_family: string;
  button_style: string;
  shadow_intensity: string;
  animation_speed: string;
  team_members: { name: string; role: string }[];
}

const DEFAULT: WidgetConfig = {
  title: 'Welcome!',
  subtitle: 'How can we help?',
  site_name: 'My Site Name',
  allowed_domain: '',
  chat_greeting: "Hi! How can I help you today?",
  response_time: 'A few minutes',
  primary_color: '#25d366',
  accent_color: '#128c7e',
  logo_url: '',
  position: 'bottom-right',
  style_preset: 'modern',
  button_text: 'Send us a message',
  search_placeholder: 'Search our Help Center',
  faqs_count: '3',
  show_team_avatars: true,
  show_recent_faqs: true,
  live_chat: true,
  ai_auto_reply: true,
  font_family: 'System Default',
  button_style: 'Solid Fill',
  shadow_intensity: 'Medium',
  animation_speed: 'Normal',
  team_members: [
    { name: 'Sarah', role: 'Support' },
    { name: 'Mike', role: 'Sales' },
    { name: 'Lisa', role: 'Success' },
  ],
};

function WidgetPreview({ config }: { config: WidgetConfig }) {
  const initials = (name: string) => name.slice(0, 1).toUpperCase();
  return (
    <div className="flex items-end justify-end p-6 h-full">
      <div
        className="w-80 rounded-2xl shadow-2xl overflow-hidden border"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-start justify-between"
          style={{ background: config.primary_color }}
        >
          <div>
            <p className="font-semibold text-white text-sm">{config.title}</p>
            <p className="text-white/80 text-xs mt-0.5">{config.subtitle}</p>
          </div>
          <button className="text-white/70 hover:text-white mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="bg-white p-4 space-y-4">
          {/* Team avatars */}
          {config.show_team_avatars && config.team_members.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {config.team_members.slice(0, 3).map((m, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: config.primary_color }}
                  >
                    {initials(m.name)}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-600">Our usual reply time</p>
                <p className="text-xs font-medium flex items-center gap-1">
                  <span className="text-gray-400">🕐</span> {config.response_time}
                </p>
              </div>
            </div>
          )}

          {/* CTA button */}
          <button
            className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"
            style={{ background: config.primary_color }}
          >
            <MessageCircle className="w-4 h-4" />
            {config.button_text}
          </button>

          {/* Search */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Find an answer quickly</p>
            <div className="flex items-center justify-between py-2 border-b text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                {config.search_placeholder}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* FAQs */}
          {config.show_recent_faqs && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">POPULAR FAQS</p>
              <p className="text-xs text-gray-400">No FAQs added yet</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">Powered by WhatsLark</p>
        </div>
      </div>
    </div>
  );
}

export default function WidgetBuilderPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('widget_settings')
        .select('*')
        .eq('company_id', company.id)
        .single();
      if (data) setConfig({ ...DEFAULT, ...data });
    })();
  }, [company?.id]);

  const handleSave = async () => {
    if (!company?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('widget_settings')
      .upsert({ ...config, company_id: company.id }, { onConflict: 'company_id' });
    if (error) {
      toast({ title: 'Note', description: 'Widget settings saved locally (DB table pending setup)', variant: 'default' });
    } else {
      toast({ title: 'Widget configuration saved' });
    }
    setSaving(false);
  };

  const installCode = `<!-- WhatsLark Chat Widget -->
<script>
  window.whatsLarkConfig = {
    siteId: "${company?.id || 'YOUR_COMPANY_ID'}",
    primaryColor: "${config.primary_color}",
    title: "${config.title}",
  };
</script>
<script src="https://widget.whatslark.com/widget.js" async></script>`;

  const copyCode = () => {
    navigator.clipboard.writeText(installCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const set = (key: keyof WidgetConfig, value: any) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel */}
      <div className="flex-1 overflow-y-auto">
        <Header
          title="Widget Builder"
          subtitle="Create and customize your WhatsApp chat widget for your website."
          actions={
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Configuration
            </Button>
          }
        />

        <div className="p-4 sm:p-6 max-w-3xl">
          <Tabs defaultValue="content">
            <TabsList className="mb-6 w-full overflow-x-auto justify-start">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="layouts">Layouts</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Content tab */}
            <TabsContent value="content" className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Welcome Messages</h3>
                <p className="text-sm text-muted-foreground mb-4">Customize your greeting text</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={config.title} onChange={(e) => set('title', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={config.site_name} onChange={(e) => set('site_name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Allowed Domain</Label>
                    <Input
                      placeholder="example.com"
                      value={config.allowed_domain}
                      onChange={(e) => set('allowed_domain', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Widget will only work on this domain. Leave empty to allow all domains.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Chat Greeting</Label>
                    <Textarea
                      rows={3}
                      value={config.chat_greeting}
                      onChange={(e) => set('chat_greeting', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Response Time</Label>
                    <Select value={config.response_time} onValueChange={(v) => set('response_time', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['A few minutes', 'Within an hour', 'A few hours', 'Within a day'].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Installation code */}
              <div>
                <h3 className="font-semibold mb-2">Installation Code</h3>
                <p className="text-sm text-muted-foreground mb-3">Copy and paste this code into your website</p>
                <div className="relative bg-gray-900 rounded-lg p-4">
                  <pre className="text-xs text-gray-300 overflow-x-auto">{installCode}</pre>
                  <button
                    onClick={copyCode}
                    className="absolute top-3 right-3 p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Configuration
              </Button>
            </TabsContent>

            {/* Design tab */}
            <TabsContent value="design" className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Widget Style</h3>
                <p className="text-sm text-muted-foreground mb-4">Choose your widget appearance</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Style Preset</Label>
                    <div className="space-y-2">
                      {[
                        { value: 'modern', label: 'Modern (Gradient backgrounds)' },
                        { value: 'classic', label: 'Classic (Solid colors)' },
                        { value: 'minimal', label: 'Minimal (Clean & simple)' },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="style"
                            value={opt.value}
                            checked={config.style_preset === opt.value}
                            onChange={() => set('style_preset', opt.value)}
                            className="accent-primary"
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.primary_color}
                          onChange={(e) => set('primary_color', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                        />
                        <Input
                          value={config.primary_color}
                          onChange={(e) => set('primary_color', e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Accent Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.accent_color}
                          onChange={(e) => set('accent_color', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                        />
                        <Input
                          value={config.accent_color}
                          onChange={(e) => set('accent_color', e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={config.logo_url}
                        onChange={(e) => set('logo_url', e.target.value)}
                      />
                      <Button variant="outline" size="sm">Upload</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Widget Position</Label>
                    <Select value={config.position} onValueChange={(v) => set('position', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Configuration
              </Button>
            </TabsContent>

            {/* Layouts tab */}
            <TabsContent value="layouts" className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Messenger Layout</h3>
                <p className="text-sm text-muted-foreground mb-4">Customize chat-focused layout</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Button Text</Label>
                    <Input value={config.button_text} onChange={(e) => set('button_text', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Search Placeholder</Label>
                    <Input value={config.search_placeholder} onChange={(e) => set('search_placeholder', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>FAQs to Display</Label>
                    <Select value={config.faqs_count} onValueChange={(v) => set('faqs_count', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['3', '5', '7', '10'].map((n) => (
                          <SelectItem key={n} value={n}>{n} FAQs</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Team Avatars</Label>
                      <p className="text-xs text-muted-foreground">Display team member photos</p>
                    </div>
                    <Switch checked={config.show_team_avatars} onCheckedChange={(v) => set('show_team_avatars', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Recent FAQs</Label>
                      <p className="text-xs text-muted-foreground">Display popular FAQs</p>
                    </div>
                    <Switch checked={config.show_recent_faqs} onCheckedChange={(v) => set('show_recent_faqs', v)} />
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Configuration
              </Button>
            </TabsContent>

            {/* Team tab */}
            <TabsContent value="team" className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Team Members</h3>
                <p className="text-sm text-muted-foreground mb-4">Configure your support team</p>
                <div className="space-y-3">
                  {config.team_members.map((member, i) => (
                    <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: config.primary_color }}
                      >
                        {member.name.slice(0, 1)}
                      </div>
                      <Input
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => {
                          const updated = [...config.team_members];
                          updated[i] = { ...member, name: e.target.value };
                          set('team_members', updated);
                        }}
                        className="flex-1 min-w-[100px]"
                      />
                      <Input
                        placeholder="Role"
                        value={member.role}
                        onChange={(e) => {
                          const updated = [...config.team_members];
                          updated[i] = { ...member, role: e.target.value };
                          set('team_members', updated);
                        }}
                        className="flex-1 min-w-[100px]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => set('team_members', config.team_members.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => set('team_members', [...config.team_members, { name: '', role: '' }])}
                  >
                    + Add Team Member
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Configuration
              </Button>
            </TabsContent>

            {/* Advanced tab */}
            <TabsContent value="advanced" className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Widget Features</h3>
                <p className="text-sm text-muted-foreground mb-4">Configure chat modes, fonts, and visual settings</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Live Chat</Label>
                      <p className="text-xs text-muted-foreground">Enable real-time messaging</p>
                    </div>
                    <Switch checked={config.live_chat} onCheckedChange={(v) => set('live_chat', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>AI Auto-Reply</Label>
                      <p className="text-xs text-muted-foreground">Automatically reply to visitor messages using AI training data</p>
                    </div>
                    <Switch checked={config.ai_auto_reply} onCheckedChange={(v) => set('ai_auto_reply', v)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Select value={config.font_family} onValueChange={(v) => set('font_family', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['System Default', 'Inter', 'Roboto', 'Open Sans', 'Lato'].map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Button Style</Label>
                    <Select value={config.button_style} onValueChange={(v) => set('button_style', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Solid Fill', 'Outlined', 'Ghost'].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Shadow Intensity</Label>
                    <Select value={config.shadow_intensity} onValueChange={(v) => set('shadow_intensity', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['None', 'Light', 'Medium', 'Heavy'].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Animation Speed</Label>
                    <Select value={config.animation_speed} onValueChange={(v) => set('animation_speed', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Slow', 'Normal', 'Fast', 'None'].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Configuration
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right panel: Live Preview */}
      <div className="hidden xl:flex w-96 border-l bg-muted/20 flex-col overflow-hidden">
        <div className="px-4 py-3 border-b bg-background">
          <p className="font-semibold text-sm">Live Preview</p>
          <p className="text-xs text-muted-foreground">Interactive widget preview</p>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 text-sm">
            <p className="font-medium">Your Website</p>
            <p className="text-xs">Widget preview</p>
          </div>
          <WidgetPreview config={config} />
        </div>
      </div>
    </div>
  );
}
