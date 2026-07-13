---
name: launch-directories
description: Launch a product across startup/launch directories (Product Hunt-style listings) by driving the real logged-in boseclaw Camoufox session — one tested, reusable flow script per directory, with proof screenshots + a live-status audit. Use when the user says "launch <product> on the directories", "submit to directories", "run the directory signups", "do the directory launch", or wants to add a directory, re-run a launch, or audit which listings went live.
---

# launch-directories — submit a product to launch directories, with proof + audit

Everything lives in `directories/`. The model is: **the loop (Claude) drives the captured
boseclaw Camoufox session** through each directory's submit flow — no API-keyed daemon, no fresh
logins (boseclaw is already signed into Google + GitHub; the session accumulates each new site's
cookies so re-runs are "hot login"). Each directory is a **script**; each run leaves **proof**;
an **audit** re-checks that listings actually went live. This is our repeatable GTM muscle — we
run it for every product we ship (Principle 17, distribution-first).

## Layout
- `engine.mjs` — Camoufox driver + action helpers `H` (goto/wait/waitFor/fill/type/click/clickIf/
  select/upload/press/url/text/has/shot) + proof capture + ledger. Pre-downloads `kit.logo` → `kit.logoFile`.
- `flows/<directory>.mjs` — one proven flow per directory: `export const meta = {directory, home,
  submitUrl}` and `export default async function launch({H, kit}) { … return {status, listingUrl, notes} }`.
  Statuses: `submitted | already-live | queued | blocked | failed`. Read `flows/peerpush.mjs`
  (OAuth + AI-autofill + logo upload + free-queue + decline-upsell), `flows/awesomeindie.mjs`
  (OAuth + form + tag-select), `flows/pitchwall.mjs` (dedup + AI-generate) as the templates.
- `kits/<product>.json` — the reusable product data (name, url, tagline, summary, description,
  categories, pricing, logo, positioningRule). One per product; every flow reads from it.
- `launch.mjs` — runner. `audit.mjs` — live re-check. `merge-rows.mjs` — fold parallel `--isolated` runs.
- `proof/` — `submissions.json` ledger + `<slug>-<directory>.png` proof shots + `audit-*.png`.

## Verbs

**Launch a product on one directory (or all):**
```bash
cd directories
node launch.mjs peerpush --kit kits/weekly-brief.json          # one directory
node launch.mjs --all    --kit kits/weekly-brief.json          # every flow, sequentially
```
Loads the boseclaw session, runs the flow, saves the session back (hot login persists), writes a
proof screenshot + a ledger row. `--headful` to watch it; `--state <file>` for another identity.

**Audit which listings are actually live (run daily / from a sub-agent):**
```bash
node audit.mjs                       # re-check every ledger row, fresh screenshots
node audit.mjs --slug weekly-brief   # just one product
```
Marks each `🟢 live` (listing loads + name present) / `🟡 pending` (queue/review wording) /
`🔴 missing` (404 or name absent → needs resubmit). Rewrites the ledger's `audit` field + timestamps.
Note: directories with no public per-product URL until approval (e.g. awesomeindie, hot100) read as
`missing` while pending — eyeball those from the proof shot rather than trusting the flag.

**Parallelize a big batch (one subagent per directory):** each subagent authors its `flows/<dir>.mjs`
and runs `node launch.mjs <dir> --kit … --isolated` (writes `proof/row-<slug>-<dir>.json`, does NOT
touch the shared ledger/session → no races). Then merge: `node merge-rows.mjs`.

## Adding a new directory (the "script per directory" step)
1. Copy the closest template from `flows/` (OAuth-form → awesomeindie; AI-autofill+logo → peerpush;
   dedup+generate → pitchwall).
2. Rewrite the selectors/steps for the new site. Develop by dropping `await H.shot('probe')` steps and
   Reading the PNGs in `proof/`; dump form field selectors with
   `node ../browser/camoufox.mjs act steps.json --state ../.secrets/boseclaw-state.json` using a
   `{"fields":true}` step.
3. **Prefer OAuth** ("Continue with Google/GitHub" → click `text=Bose Claw` → `text=Continue`): it
   usually skips the site's CAPTCHA entirely. Camoufox's real fingerprint passes Cloudflare
   Turnstile/interstitials passively; hCaptcha/reCAPTCHA image challenges may hard-block — then return
   `blocked` with proof, never fake a submission.
4. Test with `--isolated` until the proof screenshot shows a real confirmation, then `audit.mjs`.

## Rules (match the per-flow enforcement)
- **FREE tier only** — never enter payment, always decline featured/expedite/paid upsells.
- **Positioning** — obey `kit.positioningRule`; for Weekly Brief: it RANKS newsletters, it does NOT
  summarize — never write "summarize". Overwrite any AI-generated copy with `kit.summary`/`kit.description`.
- **Never invent traction** — leave metrics blank unless measured.
- **Honest proof** — a `blocked`/`failed` row with a screenshot is a real result; never record a
  submission that didn't happen (CLAUDE.md hard rules + principle 13).
- **Dedup** — check for an existing listing first; return `already-live` instead of duplicating.

## Bot identity, not gated
Directory submissions under the **boseclaw** bot identity are pre-authorized GTM (CLAUDE.md) — run
them, don't ask. The gate is only for spend, the human's personal identity, and email-domain reputation.
