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

## Sending (NOT built — separate + gated)
Cloudflare Workers **cannot** send arbitrary outbound email. The Worker `send_email` binding only
reaches addresses you've *verified you own* (self-notifications / replies), not third parties. Real
outbound = a Worker (or the loop) calls a transactional provider's HTTP API (**Resend** free tier /
Postmark / SES) with **autocomp.limed.tech** as the sender domain (needs SPF+DKIM+DMARC on that
subdomain, warmed separately). Outbound stays gated (deliverability/spam/reputation) — approval + a
warmed domain, never a quiet switch-on.
