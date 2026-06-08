'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MessageSquare, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { getInitials, formatDate } from '@/lib/utils';
import type { Contact } from '@whatslark/shared';

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Contact>(`/contacts/${id}`)
      .then(setContact)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!contact) return <div className="p-6 text-muted-foreground">Contact not found</div>;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/contacts">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="w-14 h-14">
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {getInitials(contact.name || contact.phone)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{contact.name || contact.phone}</h1>
            <p className="text-muted-foreground">{contact.phone}</p>
          </div>
        </div>
        <Button variant="outline"><Edit2 className="w-4 h-4 mr-2" />Edit</Button>
        <Button><MessageSquare className="w-4 h-4 mr-2" />Message</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {contact.phone}
            </div>
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {contact.email}
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {contact.tags?.length ? contact.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                )) : <span className="text-sm text-muted-foreground">No tags</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Added</p>
              <p className="text-sm">{formatDate(contact.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom fields</CardTitle></CardHeader>
          <CardContent>
            {contact.custom_fields && Object.keys(contact.custom_fields).length ? (
              <dl className="grid grid-cols-2 gap-3">
                {Object.entries(contact.custom_fields).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No custom fields</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
