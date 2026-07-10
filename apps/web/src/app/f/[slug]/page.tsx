'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://whatslark.onrender.com/api/v1';

interface Field {
  id: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'number' | 'date';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface PublicForm {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
  settings: {
    submit_button_text?: string;
    success_message?: string;
    redirect_url?: string;
  };
  is_active: boolean;
}

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/forms/public/${slug}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => { setForm(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const validate = () => {
    if (!form) return false;
    const errs: Record<string, string> = {};
    form.fields.forEach((f) => {
      if (f.required) {
        const v = values[f.id];
        if (f.type === 'checkbox' && !v) errs[f.id] = 'Required';
        else if (!v || (typeof v === 'string' && !v.trim())) errs[f.id] = 'Required';
      }
      if (f.type === 'email' && values[f.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.id])) {
        errs[f.id] = 'Invalid email';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !form) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload: Record<string, any> = {};
      form.fields.forEach((f) => { payload[f.label.toLowerCase().replace(/\s+/g, '_')] = values[f.id] ?? ''; });
      const res = await fetch(`${API_URL}/forms/public/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || 'Submit failed'); }
      setSubmitted(true);
      if (form.settings.redirect_url) {
        setTimeout(() => { window.location.href = form!.settings.redirect_url!; }, 1500);
      }
    } catch (e: any) {
      setSubmitError(e.message || 'Something went wrong');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form || !form.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">Form not available</p>
          <p className="text-sm text-muted-foreground">This form is either inactive or doesn't exist.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle className="w-14 h-14 mx-auto text-green-500" />
          <h2 className="text-xl font-bold">Thank you!</h2>
          <p className="text-muted-foreground">
            {form.settings.success_message || "Your response has been submitted successfully."}
          </p>
          {form.settings.redirect_url && (
            <p className="text-xs text-muted-foreground">Redirecting…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-background border rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-primary p-6 text-primary-foreground">
            <h1 className="text-xl font-bold">{form.title}</h1>
            {form.description && <p className="text-sm mt-1 opacity-90">{form.description}</p>}
          </div>

          <form onSubmit={submit} className="p-6 space-y-4">
            {form.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id} className={cn(field.required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
                  {field.label}
                </Label>

                {field.type === 'textarea' ? (
                  <Textarea
                    id={field.id}
                    placeholder={field.placeholder}
                    value={values[field.id] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                    className={cn(errors[field.id] && 'border-destructive')}
                    rows={3}
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={field.id}
                    value={values[field.id] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                    className={cn(
                      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      errors[field.id] && 'border-destructive'
                    )}
                  >
                    <option value="">{field.placeholder || 'Select…'}</option>
                    {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={field.id}
                      checked={!!values[field.id]}
                      onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.checked }))}
                      className="h-4 w-4 rounded border-input"
                    />
                    <label htmlFor={field.id} className="text-sm">{field.placeholder || field.label}</label>
                  </div>
                ) : (
                  <Input
                    id={field.id}
                    type={field.type === 'phone' ? 'tel' : field.type}
                    placeholder={field.placeholder}
                    value={values[field.id] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                    className={cn(errors[field.id] && 'border-destructive')}
                  />
                )}

                {errors[field.id] && (
                  <p className="text-xs text-destructive">{errors[field.id]}</p>
                )}
              </div>
            ))}

            {submitError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{submitError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : (form.settings.submit_button_text || 'Submit')}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">Powered by WhatsLark</p>
      </div>
    </div>
  );
}
