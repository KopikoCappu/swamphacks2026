# InkBuddy — costs, budget protection & scaling (post-demo TODO)

_Written 2026-10-17, during SwampHacks. Prices are estimates from that date — re-check each provider's pricing page before relying on them._

## ⚠️ Do this first after the demo

**The AI endpoint is open to the internet.** Anyone who finds `https://inkbuddy-api.vercel.app/ask` (it's visible in the APK and the website bundle) can spend our Claude credits — no account needed. This was left open deliberately for the demo.

Fix, in priority order:

1. **Require sign-in for `/ask`** — the app sends the Supabase access token (`Authorization: Bearer <jwt>`); the server verifies it (e.g. `supabase.auth.getUser(token)` with the service role client, or JWKS verification) and returns 401 otherwise. ~20 min.
2. **Per-user daily quota** — a `usage` table (`user_id`, `day`, `count`), incremented on each `/ask`; return 429 with a friendly "daily limit reached" when over (e.g. 30/day). RLS: users can read their own row; only the server (service role) writes.
3. **Hard monthly spend cap in the Anthropic Console** (workspace spend limits) — the backstop if everything else fails.
4. **IP rate limiting** — Vercel Firewall rate-limit rule on `/ask` (e.g. 20 req/min per IP).
5. **Request limits** — reject bodies with too many/too large images; cap `max_tokens`.
6. **Cheaper model mix** — Sonnet by default, Haiku for "To text", Opus only for "Find my mistake". Currently everything uses `ANTHROPIC_MODEL` (Opus 5.5) — see `server/src/providers.ts`.

## How sync works (for reference)

| What | When |
|---|---|
| Local edits upload | ~1.5 s after editing stops (debounced) |
| Other devices' changes download | every 20 s while the app is open, and on sign-in |
| Payload | the 20 s check fetches only `(kind, id, updated_at, deleted)`; full note JSON only for changed items |
| Conflicts | last write wins on `updatedAt` |

Code: `app/src/lib/sync.ts`. Schema + RLS: `server/supabase/schema.sql`.

## Current costs (demo setup)

| Service | Plan | Cost now | Watch out for |
|---|---|---|---|
| **Anthropic (Claude)** | pay-as-you-go | **the only real cost** | no limits unless we set them (see above) |
| Vercel — API (`inkbuddy-api`) + web (`inkbuddy`) | Hobby (free) | $0 | **Hobby is non-commercial only** → Pro ≈ $20/member/month for a real product |
| Supabase (auth + notes) | Free | $0 | ~500 MB database; **free projects pause after ~1 week idle**; Pro ≈ $25/month |
| EAS builds | Free | $0 | limited builds/month, slow queue, 45-min build timeout |
| Store publishing | — | — | Google Play $25 one-time; Apple $99/year (+ an iOS build) |
| Domain (optional) | — | ~$12/year | |

## Claude cost per AI request (estimate)

A typical request: ~3–6k input tokens (selection layers + page-view screenshot + system prompt) and ~1–3k output tokens (including adaptive thinking).

| Model | $ / MTok in / out | ≈ per request | per 1,000 requests |
|---|---|---|---|
| Opus 5.5 (current default) | $4 / $20 | $0.05–0.08 | $50–80 |
| Sonnet 5.5 | $2 / $10 | $0.02–0.04 | $25–40 |
| Haiku 5.5 | $0.10 / $0.50 | ~$0.002 | ~$2 |

Example: 100 active users × 10 requests/day on Opus ≈ **$1,500–2,500/month**; Sonnet ≈ half. Switching the default is one env var: `ANTHROPIC_MODEL` on Vercel (`vercel env add ANTHROPIC_MODEL production`, then redeploy).

Cheap wins: prompt caching for the (stable) system prompt; lower `effort` for simple modes; smaller page-view image.

## Hidden cost: photos in the database

Photos are stored as base64 inside each note's JSON (`sync_items.data`). Supabase Free fills after a few hundred photos, and every note sync moves them around. For production: upload images to object storage (Supabase Storage or Vercel Blob), keep only a URL in the note.

## Bring-your-own API key (BYOK)

| Option | How | Trade-off |
|---|---|---|
| **A. Key on device** (recommended) | Settings → "Use my own Claude key"; stored in SecureStore (native) / localStorage (web); sent with each `/ask`; server uses it for that one call and never stores or logs it | simple; our cost $0 for those users; users must trust the server |
| B. Direct from app | app calls Anthropic directly (browser needs the `anthropic-dangerous-direct-browser-access` header) | key never touches our server, but prompt/schema logic moves into the client |
| C. Encrypted in account | key stored encrypted in Supabase, works on every device | most convenient; we become responsible for securing keys |

Suggested business model: free accounts get ~20 requests/day on our key (Sonnet) → beyond that, add your own key (unlimited, free to us) or a paid subscription (Stripe).

## Rough monthly cost by stage

| Stage | Hosting | AI |
|---|---|---|
| Demo / friends (<20 users) | $0 | a few $ |
| Small launch (~500 users) | ~$45 (Vercel Pro + Supabase Pro) | $200–2,000 depending on model mix + quotas; BYOK users ≈ $0 |
| Growing | ~$50–150 (+ storage/egress) | dominated by AI → quotas + model routing matter most |
