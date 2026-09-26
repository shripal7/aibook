# aiBook API — Cloudflare Worker

A TypeScript Cloudflare Worker that reproduces the aiBook Flask API (`../backend`) 1:1 so the
mobile apps have a real hosted base URL. **All content — title metadata, per-book data, and
media — is read from a KV namespace (`CONTENT`) at request time**, so adding, editing, or
removing a book is just writing KV keys with **no redeploy** (see [ADDING-A-BOOK.md](ADDING-A-BOOK.md)).
Agent personas run on **Workers AI** with a canned fallback.

`src/data/` and `public/media/` are the human-editable source of truth; `scripts/upload-content.py`
pushes them into KV. Deploy the Worker only when you change its **code**.

## Reading analytics

The Worker records which books and which beats (pages) are read, plus coarse, anonymous
request signals — there is no login, so "who" means IP-derived geo + device, never raw IP/PII.

- **`GET /api/stats`** — instant JSON summary from KV counters: per book, the `open`/`chat`/
  `visualize`/`agent`/`quiz` counts, per-beat (page) view counts, and `countries` / `regions` /
  `devices` breakdowns. (KV counters are *approximate* under heavy concurrency.)
- **Analytics Engine (optional, precise + queryable):** each event is also written to a Workers
  Analytics Engine dataset with richer signals — country, region, city, continent, timezone,
  ISP/ASN, Cloudflare colo, browser language, device class, and a **daily-rotating visitor hash**
  for rough unique counts. It's off until you enable Analytics Engine in the Cloudflare dashboard
  and uncomment the `[[analytics_engine_datasets]]` binding in `wrangler.toml` (the code already
  guards on `env.AE`). Then query it in the dashboard or via the Analytics Engine SQL API.

`GET /api/stats` is currently public (aggregate only). Ask if you want it gated behind a secret.

## Endpoints (identical to the Flask contract)

`GET /api/health`, `GET /api/titles`, `GET /api/titles/:id`, `GET /:id/personas`,
`GET /:id/beats`, `GET/PUT /:id/beat-position`, `POST /:id/chat`, `POST /:id/visualize`,
`GET /:id/visual-bible`, `GET /:id/recap-quiz`, `POST /:id/recap-quiz/grade`,
`GET /:id/audit`, `GET /:id/rpg/proof`, `POST /:id/agents/:agentType/message`,
`GET /api/agents/status`. Images: `GET /media/...`.

## Run locally

```bash
npm install
npm run dev          # http://127.0.0.1:8787
```

Smoke test:
```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/titles
curl -X POST http://127.0.0.1:8787/api/titles/franklin/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"the thirteen virtues moral perfection","beat_index":8}'   # answered + citation
# same query at "beat_index":2 is spoiler_gated
```

> In local `wrangler dev`, `env.AI` needs Cloudflare auth; without it, live personas degrade to
> `persona.fallback_line` (`agent_call_status: "fallback"`). The `opportunity` persona and every
> non-agent endpoint work fully offline.

## Deploy

```bash
npx wrangler login       # once
npm run deploy           # https://aibook-api.<your-subdomain>.workers.dev
```

That URL is the single base URL for the Android app (`AIBOOK_API_BASE_URL` in
`../aibook-android/gradle.properties`) and serves both `/api/*` and `/media/*`.

## Deliberate divergences from the Flask app

- **Stateless audit.** No process-global log. Each `chat`/`visualize`/agent response also returns
  the computed `audit_entry`; the Android client accumulates the per-session RPG log. `GET /audit`
  and `GET /rpg/proof` are seed-based starting points.
- **No server beat state.** The spoiler gate uses the `beat_index` in each request; `PUT
  /beat-position` echoes for contract compatibility.
- **Agents.** Workers AI (`@cf/meta/llama-3.1-8b-instruct`) replaces Ollama; `opportunity` always
  serves `opportunities.json` (no live web search). `/api/agents/status` reports Workers-AI
  availability under the original `ollama_reachable` field so the client is unchanged.
- **404, not 500,** for locked/unknown titles.

## Known gap

`harness` and `ai-engineering` reference `/media/harness/*` and `/media/ai-engineering/*` images
that don't exist on disk (only `franklin` and `frankenstein` art shipped). `franklin` is the
complete hero title; visualize for the others returns `image: null` and the client renders a
graceful "No scene available" fallback.
