# Tool: Google Search Console (SEO truth for every venture)

Every venture we launch ships SEO long-tail pages; GSC is the only place that tells us whether
Google indexed them and what queries/impressions/clicks/position they earn. Reading GSC is
research → **ungated**. Auth is a **service account** (headless, no re-login) — the right shape
for the cron loop.

## One-time setup (human — see the kanban card for the tap-by-tap)
In the Google Cloud project you already have (the kanban OAuth app, project `565924017565`):
1. **Enable** the "Google Search Console API".
2. **Create a service account** → create a **JSON key** → download it.
3. Put the key on the VPS at `.secrets/gsc-sa.json` (gitignored) — the tool **auto-discovers
   it there**, no `.env` edit needed. (Override with `GOOGLE_GSC_SA_FILE` or
   `GOOGLE_GSC_SA_JSON_B64` if you keep it elsewhere.)
4. In **each** Search Console property → Settings → **Users and permissions** → add the service
   account's email (`…@…iam.gserviceaccount.com`) as **Full** (or Owner).
Property must be **verified** in GSC first (DNS TXT). We own limed.tech DNS via Cloudflare, so
the loop can add the verification TXT automatically — hand it the token and it writes the record.

## Use it
```
tools/gsc.py sites                                   # list properties the SA can see
tools/gsc.py sitemaps        "https://brief.limed.tech/"
tools/gsc.py submit-sitemap  "https://brief.limed.tech/" "https://brief.limed.tech/sitemap.xml"
tools/gsc.py analytics       "https://brief.limed.tech/" --days 28 --dim query --rows 25
tools/gsc.py inspect         "https://brief.limed.tech/" "https://brief.limed.tech/send-substack-to-kindle-free"
```
`<siteUrl>` = the exact GSC property string: URL-prefix `https://brief.limed.tech/` OR domain
property `sc-domain:limed.tech`. `analytics` prints clicks/impressions/ctr/position (top rows +
totals) for the last N days (GSC lags ~1–3 days, so it ends yesterday). `inspect` returns the
real indexing verdict/coverage/last-crawl for one URL.

## Honest failure (CLAUDE.md)
- No key set → exit 2, "not-yet-configured manual step" (never invents numbers).
- Bad key / SA not added to the property → exit 3, clean actionable message (no stack trace).
- API 4xx → exit 4 with the status + body head. The metrics collector should treat any non-zero
  exit as "GSC unavailable this run" and log that, not a zero.

## Wire-in
Feed `analytics` into `tools/metrics-collect.sh` (per venture, daily) so `autocomp.metrics_daily`
and the HQ dashboard carry real search impressions/clicks next to CF visits and signups —
turning "0 signups" into "N impressions but no clicks" (a copy problem) vs "0 impressions"
(a distribution problem). Submit each venture's sitemap once at launch via `submit-sitemap`.

## index — request a Googlebot crawl (Indexing API)
`python3 tools/gsc.py index <url> [<url> ...]` publishes a `URL_UPDATED` notification per URL via
the Google **Indexing API** (`indexing.googleapis.com/v3/urlNotifications:publish`) — the
programmatic version of GSC's UI-only "Request Indexing" (same mechanism as goenning's
google-indexing-script). Requires the SA to be an **owner** of the property (we are, via `add-site`)
and the Indexing API enabled in the Cloud project. Quota ~200 URLs/day. Officially the API targets
JobPosting/BroadcastEvent; for ordinary pages it's a widely-used crawl nudge — often faster than the
sitemap. Verified 2026-07-04: 7/7 brief.limed.tech URLs → HTTP 200. Re-run after deploying new/changed
pages. Check effect a day or two later with `gsc.py inspect`.
