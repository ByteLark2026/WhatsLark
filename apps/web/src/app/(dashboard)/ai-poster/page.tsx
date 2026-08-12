'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Send, Save, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/store/auth';
import { createClient } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const EXAMPLE_PROMPT =
  'A vibrant Eid Mubarak sale poster for a WhatsApp business, gold and deep-green color palette, crescent moon and lantern motifs, bold headline space at the top for "50% OFF", elegant Arabic-inspired border pattern, clean modern flat-design style, no text rendered in the image.';

interface Contact { id: string; name: string; phone: string }
interface Channel { id: string; name: string; phone_number: string }

export default function AiPosterPage() {
  const { company } = useAuthStore();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [contactId, setContactId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);

  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    const supabase = createClient();
    (async () => {
      const [{ data: contactRows }, { data: channelRows }] = await Promise.all([
        supabase.from('contacts').select('id, name, phone').eq('company_id', company.id).order('name').limit(200),
        supabase.from('whatsapp_channels').select('id, name, phone_number').eq('company_id', company.id),
      ]);
      setContacts((contactRows as any) || []);
      setChannels((channelRows as any) || []);
      if (channelRows?.[0]) setChannelId((channelRows[0] as any).id);
    })();
  }, [company?.id]);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await api.post<{ imageUrl: string }>('/ai-poster/generate', { prompt, provider });
      setImageUrl(res.imageUrl);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to generate poster', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const sendToClient = async () => {
    if (!imageUrl || !contactId || !channelId) return;
    setSending(true);
    try {
      await api.post('/ai-poster/send', { contactId, channelId, imageUrl, caption: caption || undefined });
      toast({ title: 'Poster sent on WhatsApp' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send poster', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const saveTemplate = async () => {
    if (!imageUrl || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await api.post('/ai-poster/save-template', {
        name: templateName.trim(),
        imageUrl,
        bodyText: caption || 'Check out our latest offer!',
      });
      toast({ title: 'Saved as template', description: 'Submit it from the Templates page.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save template', variant: 'destructive' });
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div>
      <Header title="AI Poster" subtitle="Generate a poster with AI and send it to a client on WhatsApp, or save it as a template" />

      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div>
              <Label>Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={EXAMPLE_PROMPT}
                rows={6}
                className="mt-1.5"
              />
              <button
                type="button"
                onClick={() => setPrompt(EXAMPLE_PROMPT)}
                className="text-xs text-primary mt-1.5 hover:underline"
              >
                Use example prompt
              </button>
            </div>

            <div>
              <Label>AI provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as 'openai' | 'gemini')}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">ChatGPT (OpenAI gpt-image-1)</SelectItem>
                  <SelectItem value="gemini">Nano Banana Pro (Gemini)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generate} disabled={generating || !prompt.trim()} className="w-full">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate poster
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt="Generated poster" className="w-full h-full object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground px-6 text-center">Your generated poster will appear here</p>
              )}
            </div>

            {imageUrl && (
              <>
                <div>
                  <Label>Caption (optional)</Label>
                  <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="50% off this weekend only!" className="mt-1.5" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Channel</Label>
                    <Select value={channelId} onValueChange={setChannelId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select channel" /></SelectTrigger>
                      <SelectContent>
                        {channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.phone_number}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Client</Label>
                    <Select value={contactId} onValueChange={setContactId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select contact" /></SelectTrigger>
                      <SelectContent>
                        {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.phone}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={sendToClient} disabled={sending || !contactId || !channelId} variant="default" className="w-full">
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Send to client on WhatsApp
                </Button>

                <div className="flex gap-2 pt-2 border-t">
                  <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
                  <Button onClick={saveTemplate} disabled={savingTemplate || !templateName.trim()} variant="outline">
                    {savingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save as template
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
