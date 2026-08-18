import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/widget`;

  const script = `(function () {
  var cfg = window.whatsLarkConfig || {};
  var siteId = cfg.siteId;
  if (!siteId) { console.error('[LarkFlow] siteId missing from whatsLarkConfig'); return; }

  var API = ${JSON.stringify(apiUrl)};
  var primaryColor = cfg.primaryColor || '#25D366';
  var title = cfg.title || 'Chat with us';
  var storageKey = 'wl_widget_' + siteId;
  var pollTimer = null;
  var lastMessageAt = null;
  var session = null;

  try { session = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (e) {}

  function saveSession(s) {
    session = s;
    try { localStorage.setItem(storageKey, JSON.stringify(s)); } catch (e) {}
  }

  function el(tag, styles, attrs) {
    var e = document.createElement(tag);
    if (styles) Object.assign(e.style, styles);
    if (attrs) Object.assign(e, attrs);
    return e;
  }

  var bubble = el('button', {
    position: 'fixed', bottom: '20px', right: '20px', width: '56px', height: '56px',
    borderRadius: '50%', background: primaryColor, border: 'none', cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(0,0,0,.25)', zIndex: 999999, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }, { innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>' });

  var panel = el('div', {
    position: 'fixed', bottom: '86px', right: '20px', width: '320px', height: '440px',
    background: '#fff', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,.25)',
    display: 'none', flexDirection: 'column', overflow: 'hidden', zIndex: 999999,
    fontFamily: 'sans-serif',
  });

  var header = el('div', {
    background: primaryColor, color: '#fff', padding: '14px 16px', fontWeight: '600',
  }, { textContent: title });

  var messagesEl = el('div', {
    flex: '1', overflowY: 'auto', padding: '12px', fontSize: '14px', background: '#f7f7f8',
  });

  var inputRow = el('div', { display: 'flex', borderTop: '1px solid #eee', padding: '8px' });
  var input = el('input', {
    flex: '1', border: 'none', outline: 'none', fontSize: '14px', padding: '8px',
  }, { placeholder: 'Type a message...' });
  var sendBtn = el('button', {
    border: 'none', background: primaryColor, color: '#fff', borderRadius: '6px',
    padding: '0 14px', marginLeft: '6px', cursor: 'pointer',
  }, { textContent: 'Send' });

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(header);
  panel.appendChild(messagesEl);
  panel.appendChild(inputRow);
  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  function renderMessage(msg) {
    var row = el('div', {
      display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-end' : 'flex-start',
      marginBottom: '8px',
    });
    var bub = el('div', {
      maxWidth: '75%', padding: '8px 12px', borderRadius: '10px',
      background: msg.direction === 'inbound' ? primaryColor : '#fff',
      color: msg.direction === 'inbound' ? '#fff' : '#111',
      border: msg.direction === 'inbound' ? 'none' : '1px solid #e5e5e5',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }, { textContent: msg.content });
    row.appendChild(bub);
    messagesEl.appendChild(row);
    lastMessageAt = msg.created_at;
  }

  async function ensureSession() {
    if (session && session.conversationId && session.visitorToken) {
      var res = await fetch(API + '/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, conversationId: session.conversationId, visitorToken: session.visitorToken }),
      });
      if (res.ok) { saveSession(await res.json()); return; }
    }
    var res2 = await fetch(API + '/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: siteId }),
    });
    saveSession(await res2.json());
  }

  async function poll() {
    if (!session) return;
    var qs = new URLSearchParams({
      siteId: siteId, conversationId: session.conversationId, visitorToken: session.visitorToken,
    });
    if (lastMessageAt) qs.set('after', lastMessageAt);
    try {
      var res = await fetch(API + '/messages?' + qs.toString());
      if (!res.ok) return;
      var msgs = await res.json();
      msgs.forEach(renderMessage);
      if (msgs.length) messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (e) {}
  }

  async function loadHistory() {
    var qs = new URLSearchParams({
      siteId: siteId, conversationId: session.conversationId, visitorToken: session.visitorToken,
    });
    try {
      var res = await fetch(API + '/messages?' + qs.toString());
      if (!res.ok) return;
      var msgs = await res.json();
      messagesEl.innerHTML = '';
      lastMessageAt = null;
      msgs.forEach(renderMessage);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (e) {}
  }

  async function send() {
    var text = input.value.trim();
    if (!text || !session) return;
    input.value = '';
    renderMessage({ direction: 'inbound', content: text, created_at: new Date().toISOString() });
    messagesEl.scrollTop = messagesEl.scrollHeight;
    try {
      await fetch(API + '/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, conversationId: session.conversationId, visitorToken: session.visitorToken, content: text }),
      });
    } catch (e) {}
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

  var opened = false;
  bubble.addEventListener('click', async function () {
    opened = !opened;
    panel.style.display = opened ? 'flex' : 'none';
    if (opened) {
      if (!session) await ensureSession();
      await loadHistory();
      if (!pollTimer) pollTimer = setInterval(poll, 3000);
    }
  });
})();
`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
