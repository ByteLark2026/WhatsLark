import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an automation flow builder for WhatsLark, a WhatsApp CRM platform.
Help users create automation flows by understanding their requirements in plain language.

When you have enough information to build a complete flow, output the flow as a JSON code block.
Otherwise, ask clarifying questions to understand what they need.

Available triggers:
- message_received: fires on every inbound WhatsApp message
- keyword_matched: fires when message contains specific keywords (set keywords array)
- new_contact: fires when a new contact is created
- new_conversation: fires when a new conversation starts

Available node types and their configs:
- sendMessage → config: { message: "text, use {{var_name}} for variables" }
- askQuestion → config: { question: "What is your name?", variable: "user_name" }  (saves reply to variable for later)
- template → config: { template: "approved_template_name" }
- listMsg → config: { header: "Choose", body: "Pick from list", buttonText: "View options", options: "Opt 1\nOpt 2\nOpt 3" }
- media → config: { mediaType: "image"|"video"|"document"|"audio", mediaUrl: "https://...", caption: "optional" }
- location → config: { locationName: "Our Store", address: "123 Main St", lat: "24.7136", lng: "46.6753" }
- condition → config: { conditionType: "message_contains"|"message_equals"|"variable_equals"|"always_true", conditionValue: "keyword or var=val" }
  (condition node has TWO source handles: "yes" for left, "no" for right — edges must specify sourceHandle)
- delay → config: { delayValue: "5", delayUnit: "seconds"|"minutes"|"hours" }
- variable → config: { varName: "my_var", varValue: "{{message}} or static text" }
- assign → config: { assignTo: "agent@company.com" }
- webhook → config: { method: "POST"|"GET"|"PUT", url: "https://...", body: '{"key":"{{message}}"}' }
- read → marks conversation as read (no config needed)
- addGroup → config: { group: "VIP" }
- update → config: { field: "name"|"email"|"notes", value: "{{message}} or static" }
- end → terminates the flow (no config)

When generating a flow, output ONLY valid JSON inside a \`\`\`json block like this:

\`\`\`json
{
  "name": "Flow name",
  "trigger": "message_received",
  "trigger_config": {
    "keywords": []
  },
  "nodes": [
    {"id": "start", "type": "start", "position": {"x": 250, "y": 50}, "data": {"label": "START", "type": "start"}},
    {"id": "n1", "type": "sendMessage", "position": {"x": 250, "y": 180}, "data": {"label": "Welcome", "type": "sendMessage", "config": {"message": "Hello! How can I help you?"}}},
    {"id": "end_1", "type": "end", "position": {"x": 250, "y": 310}, "data": {"label": "END", "type": "end"}}
  ],
  "edges": [
    {"id": "e1", "source": "start", "target": "n1", "animated": true, "style": {"stroke": "#94a3b8"}},
    {"id": "e2", "source": "n1", "target": "end_1", "animated": true, "style": {"stroke": "#94a3b8"}}
  ]
}
\`\`\`

For condition node edges, use sourceHandle to specify the branch:
{"id": "e_yes", "source": "c1", "sourceHandle": "yes", "target": "n_yes", ...}
{"id": "e_no", "source": "c1", "sourceHandle": "no", "target": "n_no", ...}

Then after the code block, write a short 1-2 sentence summary of what this flow does.

Rules:
- Position nodes vertically: start at y=50, each next node y += 130. For condition branches use x offset (yes left x=100, no right x=400).
- Give each non-start/end node a unique id like n1, n2, n3, c1, d1 etc.
- Keep end node id as end_1 (or end_2, end_3 for multiple end nodes)
- For keyword_matched trigger always put the keywords in trigger_config.keywords array
- Be conversational and helpful. Ask clarifying questions if the request is unclear.
- Keep messages natural and WhatsApp-friendly (short, friendly tone).
- Use {{message}} to refer to the incoming message text. Use {{variable_name}} for stored variables.`;

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured in Vercel environment variables.' }, { status: 500 });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1200,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err?.error?.message || 'OpenAI API error' }, { status: 502 });
    }

    const json = await res.json();
    const reply: string = json.choices?.[0]?.message?.content || '';

    // Extract JSON flow block if present
    let flow: any = null;
    const match = reply.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        flow = JSON.parse(match[1]);
      } catch {
        // malformed JSON from AI — return reply without flow
      }
    }

    // Strip the JSON block from the displayed reply so UI shows only the summary
    const displayReply = reply.replace(/```json[\s\S]*?```/g, '').trim();

    return NextResponse.json({ reply: displayReply || reply, flow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
