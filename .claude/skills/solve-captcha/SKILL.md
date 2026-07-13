---
name: solve-captcha
description: Solve an interactive CAPTCHA (reCAPTCHA v2, hCaptcha, or Cloudflare Turnstile) that a real browser can't clear passively — image challenges, "select all…" grids — by paying 2Captcha for a token and injecting it into the page. Use when a signup/form flow hits a CAPTCHA wall (esp. in the directory-launch flows), when the user says "solve the captcha", "wire in the solver", "use 2captcha", or when Camoufox's fingerprint isn't enough to pass a challenge. NOT for Cloudflare interstitials Camoufox already passes, and NOT a substitute for OAuth login (prefer "Continue with Google" first — it usually skips the CAPTCHA entirely).
---

# solve-captcha — token-based CAPTCHA solving via 2Captcha

Real-browser fingerprints (Camoufox) pass **passive** checks — Cloudflare interstitials, most
Turnstile, sometimes an hCaptcha/reCAPTCHA checkbox. What they can't pass is an **interactive image
challenge** ("select all crosswalks", "count the animals"). For those, we buy a solved token from
**2Captcha** and inject it into the page's hidden response field, then submit normally.

This is a **paid** service (~$0.001–0.003 per solve) — the key is authorization to spend it at that
scale; don't loop it wastefully. The API key lives by name in `.secrets/captcha.env`
(`TWOCAPTCHA_API_KEY`), gitignored, never hardcoded. Check funds: it fails loudly if the balance is 0.

## The order of preference (cheapest/most-robust first)
1. **OAuth login** ("Continue with Google/GitHub" — boseclaw is signed in). This skips the CAPTCHA
   entirely and costs nothing. ALWAYS try this before solving.
2. **Let Camoufox pass it passively** — for Turnstile / Cloudflare / a lone checkbox, just wait a few
   seconds; the hidden token often fills itself.
3. **Solve with 2Captcha** (this skill) — only when 1 and 2 fail, i.e. a real image challenge.

## Use it from a launch flow (the common case)
The solver is already wired into the directory-launch engine (`directories/engine.mjs`) as a helper.
Inside any `flows/<dir>.mjs`, at the point the CAPTCHA blocks you:
```js
// … fill the signup form, click "I'm not a robot" / submit …
await H.wait(2000);
if (await H.solveCaptcha()) {          // detects reCAPTCHA/hCaptcha/Turnstile, pays 2Captcha, injects token
  await H.click("button[type=submit]"); // now submit — the token is in the hidden field
}
```
`H.solveCaptcha()` returns `true` if it found + solved a widget, `false` otherwise (logs which). It
auto-detects the type and reads the sitekey from the page.

## Use the module directly (outside a flow)
```js
import { balance, detect, solveToken, inject, solveOnPage } from "./directories/solver.mjs";
await balance();                                  // remaining $ (throws if key missing)
const { solved, type } = await solveOnPage(page); // detect → solve → inject on a Playwright/Camoufox page
// or granular:
const d = await detect(page);                     // { type, sitekey } | null
const token = await solveToken({ type: d.type, sitekey: d.sitekey, pageurl: page.url() });
await inject(page, d.type, token);
```
Supported types: `recaptcha` (v2), `hcaptcha`, `turnstile`. Injection targets the standard hidden
fields (`g-recaptcha-response`, `h-captcha-response`, `cf-turnstile-response`) and fires a
`data-callback` if the site registered one.

## Gotchas
- **Sitekey must be present in the DOM** — `detect()` reads `data-sitekey` or the widget iframe. If a
  site loads the widget in a nested frame the detector can miss it; grab the sitekey manually and call
  `solveToken` directly.
- **Some sites bind a JS callback** rather than reading the hidden field on submit. Injection fires a
  `data-callback` best-effort; if submit still fails, the flow should report `blocked` (don't fake it).
- **reCAPTCHA v3 / Enterprise** need an `action`/score or `data-s` — pass them via `solveToken({…,
  extra:{action, "data-s":…}})`; plain v2 needs nothing extra.
- **Honest reporting** — a solve that doesn't actually get the form through is still a `blocked`
  result with proof, per the launch-directories rules. Never record a submission that didn't happen.
- **Cost discipline** — one solve per attempt; if a site challenges repeatedly, stop and report, don't
  burn the balance in a loop.

## Related
- `[[launch-directories]]` skill — the flows that call `H.solveCaptcha()`.
- The homelab **trawl-worker** solves bot-*walls* for fetches (Cloudflare/Turnstile page gates); this
  skill solves interactive *form* CAPTCHAs via paid tokens. Different jobs, complementary.
