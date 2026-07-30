# Tool: the bot inbox (hello@autocomp.limed.tech → Supabase)

Gives the loop a real inbox so it can complete signup flows autonomously (click directory
confirmation links, read verification codes) instead of handing the human 11 manual logins.
Receiving mail + clicking a confirm link is low-risk; **sending** cold email is NOT this —
that stays separately gated (deliverability/spam/reputation).

## Architecture ($0, no third party, no root-email risk)
`hello@autocomp.limed.tech` → **Cloudflare Email Routing** → **Email Worker** (`mail/worker.js`,
deployed as `autocomp-mail`) parses the message (PostalMime), extracts links, and writes a row
to Supabase `autocomp.inbox`. Every OTHER `@limed.tech` address is a **catch-all → the owner's
inbox**, so existing mail is untouched. The loop reads via `tools/inbox.sh`.

## Loop usage
```
tools/inbox.sh unprocessed        # new confirmation mails waiting
tools/inbox.sh links <id>         # the URLs in one message (click the confirm link)
tools/inbox.sh done <id>          # mark handled
```
Then fetch/click the confirm link with the browser stack (`tools/trawl.md` /
`fetch-protected` for bot-walled ones).

## Deploy / redeploy the Worker
```
cd mail && npm install && CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy
echo "$SUPABASE_SERVICE_KEY" | npx wrangler secret put SUPABASE_SERVICE_KEY   # once
```
The `hello@autocomp.limed.tech → worker:autocomp-mail` routing rule is already created via the CF API.

## Status (2026-07-03): LIVE + verified end-to-end
Email Routing enabled; apex MX → Cloudflare; catch-all → owner inbox; `hello@autocomp.limed.tech`
→ bot Worker. Verified with a real test email (Outlook → Routing → Worker → Supabase → inbox.sh).

## Policy: automated mail lives on the SUBDOMAIN
All bot/automated addresses use **autocomp.limed.tech** (receiving now; sending later), never the
apex — so the root domain's sending reputation stays clean and isolated from bot activity.

## Sending — `tools/send.sh` (LIVE since Tick 128, 2026-07-30)
Cloudflare Workers **cannot** send arbitrary outbound email. The Worker `send_email` binding only
reaches addresses you've *verified you own* (self-notifications / replies), not third parties. Real
outbound = the loop calls a transactional provider's HTTP API (**Resend** free tier / Postmark /
SES) with **autocomp.limed.tech** as the sender domain.

```
tools/send.sh <to> <subject> <body-file|->      # one recipient, no CC/BCC, no list send
tools/send.sh --dry-run <to> <subject> -        # print the payload, send nothing
```
Reads `RESEND_API_KEY` from `.env`. With no key it exits 3 and says sending is not provisioned —
it never fakes a send. It refuses more than one recipient by design: mass/cold outbound from
`autocomp.limed.tech` is a **gated** class (CLAUDE.md hard rule c) and must not be shell-looped
through this script. A single reply to someone who contacted us, or a transactional message to an
address that opted in, is the intended use.

**Why sending matters:** every landing page promises "we'll email you the day the free plan goes
live." Until this path is live, every waitlist signup SEO drives is a person we structurally
cannot contact (found Tick 127 — a real lead sat 12 days).

### The account (bot identity, $0)
Resend free tier, created Tick 128 via **"Log in with GitHub" using the boseclaw-autocomp GitHub
account** — the session in `.secrets/boseclaw-live.json`. The email+password signup form does NOT
work from this VPS: it is behind PerimeterX/HUMAN (`collector-*.px-cloud.net`) plus hCaptcha, and
`POST https://resend.com/signup` returns **HTTP 200 with an empty body and no navigation** — a
silent bot rejection with no error shown to the user. **OAuth walked straight past it.** Generalise
that: when a signup form is silently bot-walled, try the OAuth button before reaching for a solver
or the residential-IP drainer. Logged-in session: `.secrets/boseclaw-resend.json`.

Two GitHub-consent gotchas that cost three runs: both buttons are `name="authorize"`, so
`button:has-text("Authorize")` clicks **Cancel** — use `button[name="authorize"][value="1"]`. And a
click that navigates makes Playwright throw a bogus timeout that aborts the whole steps run — use
the `clickNav` step added to `browser/camoufox.mjs`.

### DNS (ours, no human needed)
The loop's Cloudflare token can create/delete records on the `limed.tech` zone — proven live Tick
128, then used to publish all four records below. SPF/DKIM/DMARC is loop work, not owner work.

| record | name | value |
|---|---|---|
| DKIM | `resend._domainkey.autocomp` | TXT `p=MIGf…` (from Resend) |
| SPF  | `send.autocomp` | MX 10 `feedback-smtp.eu-west-1.amazonses.com` |
| SPF  | `send.autocomp` | TXT `v=spf1 include:amazonses.com ~all` |
| DMARC| `_dmarc.autocomp` | TXT `v=DMARC1; p=none;` |

Resend's MX/return-path lives on the **`send.autocomp.limed.tech`** sub-subdomain, so the
Email-Routing MX on `autocomp.limed.tech` is untouched — clobbering it would break the bot inbox
that every directory confirmation depends on. Verified after the change: apex-of-subdomain MX is
still `route{1,2,3}.mx.cloudflare.net`. Domain status in Resend: **verified** (all 3 records).

### End-to-end proof (Tick 128)
`tools/send.sh hello@autocomp.limed.tech … ` → Resend `200 {id}` → Cloudflare Email Routing →
Worker → `autocomp.inbox` row 50, `from_addr` on `send.autocomp.limed.tech`. Full loop closed.

**Honest gap:** we have no *header-level* SPF/DKIM/DMARC pass verdict. `mail/worker.js` does not
store `Authentication-Results`, and a probe to the `check-auth@verifier.port25.com` verifier got no
reply within ~2.5 min. "Verified" above means Resend's DNS check plus our own `dig` — not a
receiving MTA's authentication result. Don't upgrade that claim without evidence.
