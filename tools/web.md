# Tool: Web (research / scrape / verify) — LIVE, ungated

Reading the public web is never gated. Use this to validate ideas, find leads, and verify
that shipped things actually work.

## Access matrix (verified Tick 1, 2026-06-24)

| Source | Works? | How |
|---|---|---|
| General web / articles | ✅ | `WebSearch` + `WebFetch` (default, no key) |
| **Notion pages** (e.g. taaft frameworks) | ✅ | **chrome MCP** — `navigate` then `get_page_text`; renders the SPA incl. code-block prompts. No key. |
| JS-rendered / client-side pages | ✅ | chrome MCP (same pattern) |
| **Reddit** | ❌ needs auth | Hard auth gate (not a bot challenge). `WebFetch`, chrome MCP, curl, `r.jina.ai`, AND CloakBrowser stealth all get "log in or use your developer token." Only real fixes: a **Reddit OAuth token** (free app at reddit.com/prefs/apps) or a **logged-in `--persistent` CloakBrowser profile** (see below). |
| Antibot sites (Cloudflare / Akamai / DataDome) | ✅ | **browser-search / CloakBrowser** — installed at `~/dev/browser-search` (see below). Beats these; does NOT beat Reddit's auth gate. |

**Notion read recipe (chrome):** `tabs_context_mcp` → `navigate(url)` → `get_page_text`.
Notion is a SPA, so to switch between pages do a **fresh navigate per page** (same-domain
client routing can keep the old view; if so, navigate again or reload). The full prompt body
often sits in a code block that renders a beat after the page — re-read if you see
"Loading Plain Text code…".

## Capabilities & when to use each
- **webclaw MCP** (`search`, `research`, `scrape`, `crawl`, `map`, `extract`, `summarize`) —
  default for market/competitor/demand research and structured extraction once
  `$WEBCLAW_API_KEY` is set. Reach for `research` for a question, `scrape`/`extract` for a
  page → table. **Without the key it fails on antibot/JS sites** — fall back to chrome/WebSearch.
- **Apify CLI** (`apify`) — fast public datasets: competitor followers, **Reddit threads**, Meta
  ad libraries, directories, YC lists. Run from terminal, fetch the dataset, turn into a
  table before a campaign. Needs `$APIFY_TOKEN` (ungated — it's read).
- **Playwright** (headless) — when you must read a real rendered page, screenshot it, or
  **verify** a deploy: confirm the live URL returns 200 and shows the expected headline
  (Principle 4). Also for QA of forms/dashboards.
- **chrome MCP** — the working path for Notion and other client-rendered pages. Drives real
  Chrome (uses your logged-in sessions); no API key. **Cannot reach Reddit** (safety-blocked).
- **browser-search / CloakBrowser** — installed (MIT) at `~/dev/browser-search`. Stealth
  Chromium for antibot sites (Cloudflare/Akamai/DataDome), no API key. Verified working.
  Usage: `node ~/dev/browser-search/scripts/cloak/cloak-fetch.mjs "<url>" --format markdown
  --scroll --wait 3000`. Options: `--retry`, `--proxy socks5://…`, `--persistent <dir>`
  (cookies survive — log into a site once, reuse the session). Full skill + escalation logic:
  `~/dev/browser-search/SKILL.md` (written for OpenCode; convert commands to Claude Code).
  Its SearXNG (`:8080`) + Camofox (`:9377`) Docker services are NOT installed yet — add them
  if/when the loop needs self-hosted metasearch or a warm browser.

### Reddit, specifically
Reddit deliberately gates anonymous/programmatic access. To read it the loop needs ONE of:
1. **Reddit OAuth** — user creates a free app at reddit.com/prefs/apps → client id+secret →
   `$REDDIT_CLIENT_ID` / `$REDDIT_CLIENT_SECRET` in `.env`; fetch via the official API.
2. **Persistent logged-in CloakBrowser profile** (chosen). One-time, interactive — the user
   logs in; the session is saved to a gitignored profile dir and reused headlessly:
   ```bash
   # 1) ONE TIME — user runs this, logs in (+ solves any captcha), presses Enter:
   node ~/dev/browser-search/scripts/cloak/seed-login.mjs \
     https://www.reddit.com/login ~/dev/browser-search/.reddit-profile
   # 2) Loop reuses the session (headless) on any Reddit URL:
   node ~/dev/browser-search/scripts/cloak/cloak-fetch.mjs \
     "<reddit-url>" --persistent ~/dev/browser-search/.reddit-profile --format markdown
   ```
   The `.reddit-profile` dir holds a live login session — it's gitignored; never commit it,
   never paste its contents. The loop must NOT solve captchas or perform the login itself.
Until the profile is seeded, Reddit is a gated/manual step (don't fake it).

## Rules
- Read-only. Do NOT log into third-party accounts or submit forms as outbound actions here —
  that's a `send`/destructive gate (use `outreach.md`).
- Persist findings as a real artifact in `private/memory/` (a table, not prose) so they compound.
- Cite sources (URLs) so `analyst` can trust the numbers.
