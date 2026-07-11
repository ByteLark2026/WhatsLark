import { notFound } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://whatslark.onrender.com/api/v1';

async function getInvoice(token: string) {
  const res = await fetch(`${API_URL}/invoices/public/${token}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function fmt(n: number, currency = 'AED') {
  return `${currency} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', sent: '#2563eb', paid: '#16a34a', overdue: '#dc2626', cancelled: '#9ca3af',
};

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await getInvoice(token);
  if (!inv) return notFound();

  const subtotal = (inv.line_items || []).reduce((s: number, i: any) => s + i.qty * i.unit_price, 0);
  const taxAmount = Math.round(subtotal * (inv.tax_rate || 0)) / 100;
  const total = Math.max(0, subtotal + taxAmount - (inv.discount || 0));

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#1e293b', color: '#fff', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>INVOICE</div>
            <div style={{ fontSize: 18, opacity: 0.85 }}>{inv.number}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'inline-block', background: STATUS_COLORS[inv.status] || '#6b7280',
              color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
            }}>{inv.status}</div>
          </div>
        </div>

        <div style={{ padding: '2rem' }}>
          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              {inv.contacts?.name && <><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Bill to</div>
              <div style={{ fontWeight: 600 }}>{inv.contacts.name}</div>
              {inv.contacts.email && <div style={{ color: '#6b7280', fontSize: 14 }}>{inv.contacts.email}</div>}
              {inv.contacts.phone && <div style={{ color: '#6b7280', fontSize: 14 }}>{inv.contacts.phone}</div>}</>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {inv.due_date && <><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Due date</div>
              <div style={{ fontWeight: 600 }}>{new Date(inv.due_date).toLocaleDateString()}</div></>}
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Issued {new Date(inv.created_at).toLocaleDateString()}</div>
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
              {(inv.line_items || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 0' }}>{item.description}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', color: '#6b7280' }}>{item.qty}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', color: '#6b7280' }}>{fmt(item.unit_price, inv.currency)}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontWeight: 500 }}>{fmt(item.qty * item.unit_price, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <div style={{ width: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#6b7280', fontSize: 14 }}>
                <span>Subtotal</span><span>{fmt(subtotal, inv.currency)}</span>
              </div>
              {(inv.tax_rate || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#6b7280', fontSize: 14 }}>
                  <span>Tax ({inv.tax_rate}%)</span><span>{fmt(taxAmount, inv.currency)}</span>
                </div>
              )}
              {(inv.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#16a34a', fontSize: 14 }}>
                  <span>Discount</span><span>-{fmt(inv.discount, inv.currency)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, fontSize: 18, borderTop: '2px solid #1e293b', marginTop: 4 }}>
                <span>Total</span><span>{fmt(total, inv.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem', fontSize: 14, color: '#374151' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>Notes</div>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{inv.notes}</p>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '1rem', background: '#f9fafb', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
          Generated by WhatsLark
        </div>
      </div>
    </div>
  );
}
