# tool: daily metrics collector (metrics-collect.sh)

One row per active company per UTC day in `autocomp.metrics_daily` on the shared Supabase —
the measured-numbers substrate for KPIs, the HQ dashboard, and any public `/live` feed.

## Table
`autocomp.metrics_daily (company_slug text, day date, cf_views int, cf_visits int,
signups int, revenue_usd numeric, human_visits int, collected_at timestamptz default now(),
primary key (company_slug, day))` — RLS enabled; service key writes, upsert on conflict.
(`human_visits` added 2026-07-03 via `alter table … add column if not exists`, nullable.)

## What each column measures (honest definitions)
- `cf_views` — Cloudflare **eyeball HTTP requests** to the venture's hostname for the day.
  The free plan denies the `edgeResponseContentTypeName` (HTML-only) filter, so this is the
  closest measurable per-hostname proxy for page views — it overcounts vs. true page views
  (includes assets). Consistent over time, so trends are real.
- `cf_visits` — Cloudflare `sum(visits)` for the same slice (CF's visit definition).
- `signups` — `count(*)` of the venture's signup table (total to date, not per-day delta;
  daily deltas fall out of consecutive rows).
- `revenue_usd` — gross Stripe charges (paid, minus refunds) **created that day**, ventures
  with billing only; `NULL` = not measurable (no key / no billing), never a guessed 0.
- `human_visits` — rows in the venture's **page-load beacon** table (`POST /api/visit` fired
  by executed JS on every real page load) for the UTC day, **excluding UAs that declare
  themselves as automation** (`headless|playwright|phantom|bot|spider|crawl|curl|wget|python`,
  case-insensitive). Rationale: the beacon requires JS execution, so plain crawlers never fire
  it; the residual pollution is headless browsers — mostly our own Playwright verification
  (ua `HeadlessChrome`) — so the filtered count is the honest one. Raw counts stay queryable
  in the beacon table. CF-edge `cf_visits` measured ~85–95% bots, so THIS is the real-traffic
  metric. `NULL` = venture has no beacon. **Coverage note: weeklybrief's beacon went live
  mid-day 2026-07-02, so the 2026-07-02 value is a partial-coverage day.**

## Query used (Cloudflare GraphQL Analytics API, verified 2026-07-02)
Dataset `httpRequestsAdaptiveGroups`, zone-scoped, 1-day slice (free-plan-safe), filter
`{date: $day, clientRequestHTTPHost: $host, requestSource: "eyeball"}`, fields
`count` + `sum { visits }`. Zero groups returned = a real measured 0/0.

## Env var NAMES (.env — never inline values)
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (reads registry, counts signups, upserts rows);
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` (GraphQL analytics, read-only);
`STRIPE_SECRET_KEY` (restricted `rk_` key, read-only charges; optional — missing ⇒ NULL revenue).

## Per-venture config (in the script's `config_for`)
| slug | hostname | signup table | stripe | visits beacon table |
|---|---|---|---|---|
| weeklybrief | brief.limed.tech | weeklybrief.signups | yes | weeklybrief.visits |
| autocomp | autocomp.limed.tech | autocomp.waitlist | no | — |

New venture ⇒ add one `case` line. Active registry companies without a config line are
skipped LOUDLY (stderr + non-zero exit), so the gap surfaces instead of rotting.

## Use
```
tools/metrics-collect.sh              # collect for today (UTC) — partial day
tools/metrics-collect.sh 2026-07-01   # collect/backfill a specific day
```
Upserts (merge-duplicates), so re-running a day just refreshes it. Fails loudly (stderr,
non-zero) on missing keys or failed signup/CF calls — never silent NULL-everything rows.

## Cron (installed 2026-07-02, user crontab)
```
10 2 * * * /home/j/autocomp/tools/metrics-collect.sh "$(date -u -d yesterday +\%F)" >> /home/j/autocomp/private/state/metrics-collect.log 2>&1
```
Runs daily at 02:10 UTC and collects **yesterday** — a complete, finalized UTC day.
