---
name: fetch-protected
description: Fetch a page that is behind a bot wall — Cloudflare / Turnstile / hCaptcha / reCAPTCHA / DataDome / Akamai — using a real human-like browser via TRAWL (a FlareSolverr-v2-compatible solver that drives a genuine Camoufox Firefox). Use when WebFetch/curl return a challenge page, 403, "Just a moment…", "Checking your browser", or an empty/blocked body, or when a task says to scrape/verify a site known to block bots. NOT for auth-gated sites (Reddit login, paywalls) — a solver doesn't beat a real login.
---

# fetch-protected — read bot-walled pages with a real browser

Plain HTTP clients (`curl`, `WebFetch`) get a challenge page instead of content on
Cloudflare/DataDome/etc. TRAWL solves the challenge in a **real Camoufox Firefox context**
(fingerprint-spoofed at the engine level, not JS patches — so it reads as a human browser),
then returns the solved HTML. It's FlareSolverr-v2-compatible and caches solved sessions in
Redis, so repeat hits to the same domain come back in ~500ms.

## When to use vs. not
- **Use** when a fetch returns: `403`, `503`, "Just a moment…", "Checking your browser",
  "Enable JavaScript and cookies", a Turnstile/hCaptcha/reCAPTCHA widget, or a suspiciously
  empty body — i.e. a **bot challenge**, not a login.
- **Don't use** for a real **auth gate** (Reddit "log in", paywalls, member areas). A solver
  passes bot checks; it does not have your account. For those, use a real logged-in session
  (OAuth token / persistent profile) — see `tools/web.md`.
- **Escalate to it** only after a plain `WebFetch` fails. Plain HTTP is free and instant;
  the browser tier costs seconds. TRAWL itself does this internally (4 tiers: plain HTTP →
  cached session → live browser → residential proxy), so a single call is already cost-tiered.

## How (always via the helper — never hand-roll the JSON)
Config: set `TRAWL_URL` in `.env` (e.g. `http://localhost:8191` or your homelab URL).

```bash
tools/trawl.sh health                                  # is a solver reachable?
tools/trawl.sh get "https://target.example/page"       # -> solved HTML on stdout
tools/trawl.sh get "https://target.example" -s mysess  # reuse a cached session (fast repeats)
tools/trawl.sh get "https://api.example/x" -H 'Authorization: Bearer T' -H 'Referer: https://example'
tools/trawl.sh post "https://target.example/form" 'field=1&field2=2'
tools/trawl.sh json get "https://target.example"       # full JSON (cookies, userAgent, tier, status)
```

The helper shapes the FlareSolverr-v2 request (`cmd:"request.get"`, `url`, `maxTimeout`,
optional `session`/`session_ttl`, `postData`, `headers`) and returns `solution.response`
(the HTML) on success. Custom headers pass through all tiers including the browser.

## Success criterion (verify — Principle 4)
A solve is only "done" when the returned HTML contains the **real content**, not another
challenge. After fetching, grep the body for the expected marker (a headline, a data field)
AND confirm it does NOT still contain "Just a moment" / "cf-challenge" / a captcha widget id.
If it does, the solve failed — report that, don't treat the challenge page as the answer.

## Honest failure / fallback (CLAUDE.md)
- No `TRAWL_URL` set, or the box is unreachable → `trawl.sh` exits non-zero. **Fall back** to
  the next option in `tools/web.md` (CloakBrowser, chrome MCP, Apify) — never fake a fetch.
- Solve returns a non-2xx/3xx status → surface the status + message; do not invent content.
- TRAWL is early software (self-hosted homelab tool). Treat it as best-effort: try it first
  for known bot-walled targets, but always have the documented fallback ready.

## Related
- `tools/trawl.md` — the loop-side integration playbook (env, docker, tier model).
- `tools/web.md` — the full access matrix and the fallback ladder.
