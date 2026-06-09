'use client';

import { useEffect, useState } from 'react';
import { Bot, Loader2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import type { AISettings } from '@whatslark/shared';
import { useToast } from '@/hooks/use-toast';

export default function AiBotPage() {
  const { toast } = useToast();
  const { company } = useAuthStore();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    const supabase = createClient();
    supabase
      .from('ai_settings')
      .select('*')
      .eq('company_id', company.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setSettings(data as unknown as AISettings);
        setLoading(false);
      });
  }, [company?.id]);

  const handleSave = async () => {
    if (!settings || !company?.id) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ai_settings')
      .update({
        is_enabled: settings.is_enabled,
        auto_reply: settings.auto_reply,
        handover_keyword: settings.handover_keyword,
        system_prompt: settings.system_prompt,
        model: settings.model,
      })
      .eq('company_id', company.id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSettings(data as unknown as AISettings);
      toast({ title: 'AI settings saved' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <Header title="AI Bot" />
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="AI Bot"
        subtitle="Configure your AI-powered auto-reply assistant"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save settings
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold">AI Assistant</p>
                  <p className="text-sm text-muted-foreground">Enable AI-powered responses for your conversations</p>
                </div>
              </div>
              <Switch
                checked={settings?.is_enabled ?? false}
                onCheckedChange={(v) => setSettings((s) => s ? { ...s, is_enabled: v } : s)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-reply</CardTitle>
            <CardDescription>Automatically reply to incoming messages using AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable auto-reply</Label>
              <Switch
                checked={settings?.auto_reply ?? false}
                onCheckedChange={(v) => setSettings((s) => s ? { ...s, auto_reply: v } : s)}
                disabled={!settings?.is_enabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Human handover keyword</Label>
              <Input
                placeholder="e.g. agent, human, talk to someone"
                value={settings?.handover_keyword ?? ''}
                onChange={(e) => setSettings((s) => s ? { ...s, handover_keyword: e.target.value } : s)}
              />
              <p className="text-xs text-muted-foreground">When a customer types this keyword, the bot stops and a human agent takes over.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" /> Model & Prompt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>AI Model</Label>
              <Select value={settings?.model ?? 'gpt-4o-mini'} onValueChange={(v) => setSettings((s) => s ? { ...s, model: v } : s)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast, affordable)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (Best quality)</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>System prompt</Label>
              <Textarea
                rows={6}
                placeholder="You are a helpful customer support assistant. Be friendly, concise and helpful."
                value={settings?.system_prompt ?? ''}
                onChange={(e) => setSettings((s) => s ? { ...s, system_prompt: e.target.value } : s)}
              />
              <p className="text-xs text-muted-foreground">This prompt defines the AI&apos;s personality and knowledge boundaries.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
