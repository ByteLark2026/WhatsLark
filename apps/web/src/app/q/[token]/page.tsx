'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://whatslark.onrender.com/api/v1';

function fmt(n: number, currency = 'AED') {
  return `${currency} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', sent: '#2563eb', accepted: '#16a34a', rejected: '#dc2626', converted: '#7c3aed',
};

export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'accept' | 'reject' | null>(null);
  const [done, setDone] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/quotations/public/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject('Not found'))
      .then(setQuote)
      .catch(() => setError('Quotation not found or link expired.'));
  }, [token]);

  const respond = async (type: 'accept' | 'reject') => {
    setAction(type);
    try {
      await fetch(`${API_URL}/quotations/public/${token}/${type}`, { method: 'POST' });
      setQuote((q: any) => ({ ...q, status: type === 'accept' ? 'accepted' : 'rejected' }));
      setDone(type === 'accept' ? 'You have accepted this quotation.' : 'You have declined this quotation.');
    } catch {
      setError('Action failed. Try again.');
    }
    setAction(null);
  };

  if (error) return <div style={{ textAlign: 'center', padding: '4rem', fontFamily: 'system-ui', color: '#dc2626' }}>{error}</div>;
  if (!quote) return <div style={{ textAlign: 'center', padding: '4rem', fontFamily: 'system-ui', color: '#6b7280' }}>Loading…</div>;

  const subtotal = (quote.line_items || []).reduce((s: number, i: any) => s + i.qty * i.unit_price, 0);
  const taxAmount = Math.round(subtotal * (quote.tax_rate || 0)) / 100;
  const total = Math.max(0, subtotal + taxAmount - (quote.discount || 0));
  const canRespond = quote.status === 'sent';

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#312e81', color: '#fff', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>QUOTATION</div>
            <div style={{ fontSize: 18, opacity: 0.85 }}>{quote.number}</div>
          </div>
          <div>
            <div style={{
              display: 'inline-block', background: STATUS_COLORS[quote.status] || '#6b7280',
              color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
            }}>{quote.status}</div>
          </div>
        </div>

        <div style={{ padding: '2rem' }}>
          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              {quote.contacts?.name && <><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Prepared for</div>
              <div style={{ fontWeight: 600 }}>{quote.contacts.name}</div>
              {quote.contacts.email && <div style={{ color: '#6b7280', fontSize: 14 }}>{quote.contacts.email}</div>}</>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {quote.valid_until && <><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Valid until</div>
              <div style={{ fontWeight: 600 }}>{new Date(quote.valid_until).toLocaleDateString()}</div></>}
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Issued {new Date(quote.created_at).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Line items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Description</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: '#6b7280', width: 60 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: '#6b7280', width: 110 }}>Unit Price</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: '#6b7280', width: 110 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(quote.line_items || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 0' }}>{item.description}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', color: '#6b7280' }}>{item.qty}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', color: '#6b7280' }}>{fmt(item.unit_price, quote.currency)}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontWeight: 500 }}>{fmt(item.qty * item.unit_price, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <div style={{ width: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#6b7280', fontSize: 14 }}>
                <span>Subtotal</span><span>{fmt(subtotal, quote.currency)}</span>
              </div>
              {(quote.tax_rate || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#6b7280', fontSize: 14 }}>
                  <span>Tax ({quote.tax_rate}%)</span><span>{fmt(taxAmount, quote.currency)}</span>
                </div>
              )}
              {(quote.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#16a34a', fontSize: 14 }}>
                  <span>Discount</span><span>-{fmt(quote.discount, quote.currency)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, fontSize: 18, borderTop: '2px solid #312e81', marginTop: 4 }}>
                <span>Total</span><span>{fmt(total, quote.currency)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem', fontSize: 14, color: '#374151', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>Notes</div>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem', fontSize: 14, color: '#374151', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>Terms & Conditions</div>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{quote.terms}</p>
            </div>
          )}

          {/* Action buttons (sent state only) */}
          {canRespond && !done && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => respond('accept')} disabled={!!action}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>
                <CheckCircle size={18} /> {action === 'accept' ? 'Accepting…' : 'Accept Quotation'}
              </button>
              <button onClick={() => respond('reject')} disabled={!!action}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#fff', color: '#dc2626', border: '2px solid #dc2626', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>
                <XCircle size={18} /> {action === 'reject' ? 'Declining…' : 'Decline'}
              </button>
            </div>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: '1.5rem', marginTop: '1rem', background: quote.status === 'accepted' ? '#f0fdf4' : '#fef2f2', borderRadius: 8, color: quote.status === 'accepted' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {done}
            </div>
          )}
          {error && <div style={{ textAlign: 'center', color: '#dc2626', marginTop: '1rem' }}>{error}</div>}
        </div>

        <div style={{ textAlign: 'center', padding: '1rem', background: '#f9fafb', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
          Generated by WhatsLark
        </div>
      </div>
    </div>
  );
}
