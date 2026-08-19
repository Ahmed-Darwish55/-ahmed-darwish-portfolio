# Assistant proxy (optional)

The site's **Ask** panel works with no server at all: it searches
`public/data/content.json`, `public/data/site.json` and `public/data/cv.txt`
in the browser and answers from what it finds. Nothing is invented, nothing
costs anything, and it works from `file://`.

If you want conversational, free-form answers instead of matched cards, deploy
this Worker and point the site at it.

## 1 · Deploy

```bash
npm i -g wrangler
wrangler login
wrangler deploy worker/assistant.js --name ahmed-assistant --compatibility-date 2024-11-01
wrangler secret put ANTHROPIC_API_KEY --name ahmed-assistant   # paste the key
```

## 2 · Allow your domain

Edit the `ALLOWED` array at the top of `assistant.js` and redeploy. Requests
from any other origin are refused, so the endpoint cannot be used as a free
Claude proxy by someone else.

## 3 · Point the site at it

In `public/data/site.json`:

```json
"assistant": { "endpoint": "https://ahmed-assistant.<your-subdomain>.workers.dev" }
```

Leave `endpoint` as `""` to stay fully local. If the Worker is unreachable,
rate-limited or errors, the panel silently falls back to the local engine —
a visitor never sees a broken assistant.

## Cost

Each answer sends the retrieved context (usually under 2 KB) and returns at
most 400 tokens. Cloudflare's free tier covers 100,000 requests a day; the
model calls are billed by Anthropic per token.
