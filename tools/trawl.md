# Tool: TRAWL — real-browser fetch for bot-walled sites (FlareSolverr-v2 drop-in)

TRAWL (https://github.com/germondai/trawl · https://trawl.germondai.com) solves bot
challenges (Cloudflare, Turnstile, hCaptcha, reCAPTCHA v2, GeeTest v4, DataDome/Akamai) by
driving a **real Camoufox Firefox** — human-like at the engine level (C++ fingerprint
spoofing), not brittle JS stealth patches. It's a drop-in replacement for FlareSolverr v2:
same `/v1` request shape, so anything that spoke FlareSolverr speaks TRAWL by changing one URL.

Reading the public web is **ungated** (CLAUDE.md) — TRAWL is just a better fetch tier, not a
spend/send action. Use it, don't gate it.

## Why it's in our stack
The loop hits real Cloudflare walls (evidence: past contact-form scrapes died on "Cloudflare
JS challenge"). TRAWL's edges over our other options:
- **Human-real browser** (Camoufox) — passes checks that headless Chromium trips.
- **Redis session cache** — first solve for a domain is 4–15s; repeats ~500ms.
- **4-tier execution** — plain HTTP → cached session → live browser → residential proxy. You
  pay the browser cost only when the cheaper tiers fail, so a single call is already
  cost-tiered (mirrors our own escalate-only-when-needed rule).
- **In-page captcha solving** — Turnstile (shadow-DOM click), reCAPTCHA v2 (free Google STT
  audio), hCaptcha auto-pass, GeeTest v4.

## Config (.env)
```
TRAWL_URL=http://localhost:8191      # or your homelab/VPS instance; the *arr default port is 8191
```
No API key. If `TRAWL_URL` is unset or the box is down, `tools/trawl.sh` exits non-zero and the
caller falls back down the `tools/web.md` ladder — never fakes a solve.

## Run an instance (self-host)
```
git clone https://github.com/germondai/trawl && cd trawl && docker compose up -d
curl http://localhost:8191/health          # must return ok
```
Compose brings up the scraper + Redis. Env knobs: `PORT_API` (8191), `SESSION_TTL_SECONDS`
(3600), `REDIS_URL` (redis://localhost:6379).

## Pull-worker mode — the loop's VPS is a datacenter IP, so don't host TRAWL here
Our loop runs on a DigitalOcean box: CAPTCHA vendors flag datacenter IPs hard, and a real
Camoufox Firefox (shm 1GB, browser pool) would OOM the 3.8GB/96%-full VPS. So TRAWL runs on a
**residential-IP homelab** and the loop reaches it through a **queue**, not a URL:
- Loop side: `tools/solve.sh get <url>` enqueues a `solve_jobs` row (Supabase) and waits for
  the solved HTML. `solve.sh workers` shows whether a homelab is draining.
- Homelab side: `trawl-worker/` (docker-compose: TRAWL + Redis + a stdlib worker) claims jobs
  via the atomic `claim_solve_job` RPC, runs local TRAWL, writes the result back. Outbound-only
  — no exposed ports, no tunnel. Setup: `trawl-worker/README.md`.
Prefer this over `TRAWL_URL=` whenever the solver can't live next to the loop. If TRAWL *is*
co-located (homelab loop), the direct `TRAWL_URL` + `tools/trawl.sh` path still works.

## API (FlareSolverr-v2, `POST /v1`)
Request: `{cmd:"request.get"|"request.post", url, maxTimeout, session?, session_ttl?,
postData?, headers?}` — `headers` (Authorization/Referer/Origin/…) pass through all tiers
incl. the browser. Response: `{status, message, solution:{url, status, response, cookies,
userAgent, headers}}` — `solution.response` is the solved HTML. Native `POST /scrape` returns
extra `tier`, `timings`, `sessionCached`. Health: `GET /health`.

## Use it (helper)
Always via `tools/trawl.sh` (shapes the JSON, parses the result, honest exit codes) — see the
`fetch-protected` skill for the command recipes and the verify-the-solve success criterion.
Point Prowlarr/Jackett at `TRAWL_URL` too — FlareSolverr-v2 compatible, change one URL.

## Fallback ladder (from tools/web.md)
plain `WebFetch`/curl  →  **TRAWL** (bot walls, real browser)  →  CloakBrowser stealth
(`~/dev/browser-search`)  →  chrome MCP (JS/Notion)  →  Apify datasets. Auth gates (Reddit,
paywalls) are a different problem — a solver won't beat a login; use a real session/token.
