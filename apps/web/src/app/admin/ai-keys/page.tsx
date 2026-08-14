'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AiProviderKey {
  id: string;
  provider: string;
  label: string;
  api_key_masked: string | null;
  is_active: boolean;
  created_at: string;
}

const PROVIDERS = ['openai', 'gemini', 'grok', 'kimi', 'claude', 'deepseek'];

export default function AdminAiKeysPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<AiProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ provider: 'openai', label: '', api_key: '' });

  const load = () => {
    setLoading(true);
    api.get<AiProviderKey[]>('/admin/ai-keys')
      .then(setKeys)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    if (!form.label.trim() || !form.api_key.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/admin/ai-keys', form);
      toast({ title: 'Key added' });
      setOpen(false);
      setForm({ provider: 'openai', label: '', api_key: '' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (key: AiProviderKey) => {
    try {
      await api.patch(`/admin/ai-keys/${key.id}`, { is_active: !key.is_active });
      setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, is_active: !k.is_active } : k)));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (key: AiProviderKey) => {
    if (!confirm(`Delete key "${key.label}"? Anything relying on it falls back to the next active key, or the OPENAI_API_KEY env var if none remain.`)) return;
    try {
      await api.delete(`/admin/ai-keys/${key.id}`);
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      toast({ title: 'Key deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Keys</h1>
          <p className="text-muted-foreground">Manage OpenAI API keys used for AI Bot replies, flow generation, and voice transcription.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Key</Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        The most recently added <strong>active</strong> OpenAI key is used everywhere the app calls AI (auto-reply, flow generation, voice agent, transcription). If none are active, it falls back to the <code className="text-xs bg-muted px-1 py-0.5 rounded">OPENAI_API_KEY</code> environment variable.
      </p>
      <p className="text-xs text-amber-600 mb-4">
        Gemini is wired for AI Bot auto-reply — pick a Gemini model on a company's AI Bot page and it uses the active Gemini key here. Grok / Kimi / Claude / DeepSeek keys can be stored but aren't wired to any feature yet.
      </p>

      {loading ? (
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
      ) : keys.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <KeyRound className="w-8 h-8 mx-auto mb-2" />
          No keys added yet — using OPENAI_API_KEY from environment variables.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{key.label}</p>
                    <Badge variant="outline" className="text-xs capitalize">{key.provider}</Badge>
                    <Badge variant={key.is_active ? 'mono' : 'secondary'} className="text-xs">{key.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{key.api_key_masked}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Switch checked={key.is_active} onCheckedChange={() => toggleActive(key)} />
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(key)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add AI Key</DialogTitle>
            <DialogDescription>Add an OpenAI API key. It becomes active immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input placeholder="e.g. Primary key, Backup key" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input type="password" placeholder="sk-..." value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting || !form.label.trim() || !form.api_key.trim()}>
              {submitting ? 'Adding…' : 'Add Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
