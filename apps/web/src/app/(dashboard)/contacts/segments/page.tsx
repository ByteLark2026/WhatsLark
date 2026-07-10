'use client';

import { useEffect, useState } from 'react';
import { Plus, Users, Tag, Trash2, Edit2, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filters: any | null;
  contact_count: number;
  created_at: string;
}

interface FormState {
  name: string;
  description: string;
  tag_filter: string;
}

export default function SegmentsPage() {
  const { company, user } = useAuthStore();
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', description: '', tag_filter: '' });

  // Contacts to show when viewing segment
  const [viewSegment, setViewSegment] = useState<Segment | null>(null);
  const [viewContacts, setViewContacts] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const loadSegments = async () => {
    if (!company?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('contact_segments')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setSegments((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadSegments(); }, [company?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', tag_filter: '' });
    setDialogOpen(true);
  };

  const openEdit = (seg: Segment) => {
    setEditing(seg);
    setForm({
      name: seg.name,
      description: seg.description || '',
      tag_filter: seg.filters?.tags?.join(', ') || '',
    });
    setDialogOpen(true);
  };

  const saveSegment = async () => {
    if (!form.name.trim() || !company?.id) return;
    setSaving(true);
    const supabase = createClient();

    const tags = form.tag_filter.split(',').map((t) => t.trim()).filter(Boolean);
    const filters = tags.length > 0 ? { tags } : null;

    if (editing) {
      const { error } = await supabase
        .from('contact_segments')
        .update({ name: form.name.trim(), description: form.description.trim() || null, filters, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Segment updated' }); setDialogOpen(false); await loadSegments(); }
    } else {
      const { error } = await supabase
        .from('contact_segments')
        .insert({ company_id: company.id, name: form.name.trim(), description: form.description.trim() || null, filters, created_by: user?.id });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Segment created' }); setDialogOpen(false); await loadSegments(); }
    }
    setSaving(false);
  };

  const deleteSegment = async (seg: Segment) => {
    if (!confirm(`Delete segment "${seg.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('contact_segments').delete().eq('id', seg.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Segment deleted' });
    setSegments((prev) => prev.filter((s) => s.id !== seg.id));
  };

  const viewSegmentContacts = async (seg: Segment) => {
    setViewSegment(seg);
    setViewLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('company_id', company!.id)
      .limit(50);

    // If segment has tag filters, join through contact_tags
    if (seg.filters?.tags?.length) {
      // Static segments: load from contact_segment_members
      const { data: members } = await supabase
        .from('contact_segment_members')
        .select('contact_id, contacts(id, name, phone, email)')
        .eq('segment_id', seg.id);
      setViewContacts(members?.map((m: any) => m.contacts).filter(Boolean) || []);
    } else {
      const { data } = await query;
      setViewContacts(data || []);
    }
    setViewLoading(false);
  };

  const visible = segments.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Header
        title="Contact Segments"
        subtitle="Group contacts into segments for targeted campaigns"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />New Segment
          </Button>
        }
      />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search segments…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm">{segments.length === 0 ? 'No segments yet' : 'No matches'}</p>
            {segments.length === 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>Create first segment</Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((seg) => (
              <Card key={seg.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{seg.name}</p>
                      {seg.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{seg.description}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(seg)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSegment(seg)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {seg.filters?.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {seg.filters.tags.map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          <Tag className="w-2.5 h-2.5 mr-1" />{t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span>{seg.contact_count} contacts</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => viewSegmentContacts(seg)}>
                      View
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{formatDate(seg.created_at)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Segment' : 'New Segment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. VIP Customers" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What is this segment for?" className="h-20" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />Tag filter (optional)
              </Label>
              <Input
                value={form.tag_filter}
                onChange={(e) => setForm((f) => ({ ...f, tag_filter: e.target.value }))}
                placeholder="tag1, tag2, tag3 (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">Leave blank for a manual segment — add contacts individually</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSegment} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View contacts dialog */}
      <Dialog open={!!viewSegment} onOpenChange={() => setViewSegment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewSegment?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {viewLoading ? (
              <div className="space-y-2 py-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
              </div>
            ) : viewContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No contacts in this segment</p>
            ) : (
              <div className="divide-y">
                {viewContacts.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {(c.name || c.phone || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                  </div>
                ))}
                {viewContacts.length === 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Showing first 50 contacts</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
