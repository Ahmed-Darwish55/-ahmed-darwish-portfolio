/* ==================================================================
   ASSISTANT PROXY — Cloudflare Worker
   ------------------------------------------------------------------
   Optional. Without it the site's assistant answers locally from the
   JSON. With it, the same retrieved context is handed to Claude and
   the answer comes back as prose.

   The API key lives here, as a Worker secret — never in the page.

   Deploy:
     npm i -g wrangler
     wrangler login
     wrangler deploy worker/assistant.js --name ahmed-assistant \
       --compatibility-date 2024-11-01
     wrangler secret put ANTHROPIC_API_KEY --name ahmed-assistant

   Then put the Worker URL in public/data/site.json:
     "assistant": { "endpoint": "https://ahmed-assistant.<you>.workers.dev" }
   ================================================================== */

/* Only these origins may call it. Add your domain before going live. */
const ALLOWED = [
  'https://ahmeddarwish.dev',
  'https://ahmed5510-mac.github.io',
  'http://localhost:5173',
];

const MODEL = 'claude-sonnet-4-5';
const MAX_QUESTION = 500;
const MAX_CONTEXT = 20000;

const SYSTEM = `You answer questions about Ahmed Darwish, a Frontend & GIS developer based in Dammam, Saudi Arabia, on behalf of his portfolio site.

Rules:
- Answer ONLY from the CONTEXT provided. If the context does not contain the answer, say so plainly and suggest what the visitor could ask instead.
- Never invent employers, dates, numbers, tools or claims. Do not embellish.
- The Esri Award for Excellence was given to the SRD platform; Ahmed built its front end. Never say he personally won it.
- Reply in the same language as the question (Arabic or English).
- Two to four sentences. Plain text, no markdown headings, no bullet lists unless the question asks for a list.
- Write about Ahmed in the third person.`;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const headers = { ...cors(origin), 'Content-Type': 'application/json' };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
    if (origin && !ALLOWED.includes(origin))
      return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403, headers });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers });
    }

    const question = String(body.question ?? '').slice(0, MAX_QUESTION).trim();
    const context = String(body.context ?? '').slice(0, MAX_CONTEXT);
    const lang = body.lang === 'ar' ? 'Arabic' : 'English';
    if (!question) return new Response(JSON.stringify({ error: 'no question' }), { status: 400, headers });

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `CONTEXT (everything known about Ahmed that is relevant to this question):\n\n${context}\n\nVISITOR QUESTION (${lang}): ${question}`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(JSON.stringify({ error: 'upstream', detail: detail.slice(0, 300) }), {
        status: 502,
        headers,
      });
    }

    const data = await upstream.json();
    const answer = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return new Response(JSON.stringify({ answer }), { headers });
  },
};
