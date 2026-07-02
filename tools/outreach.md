# Tool: Outreach (cold email / social) — GUARDED (sends)

Drafting and CRM enrichment are fine. Sending anything to a third party is a `send` gate.

## Gate first
Sending email / DMs / social posts → `private/state/approvals.md` `PENDING` + `AskUserQuestion` with
the full recipient list and message previews. Execute only after `APPROVED` AND with the
provider key (`$RESEND_API_KEY` for email, `$UPLOAD_POST_API_KEY` for social). Missing key →
`manual` step.

## What you can do ungated
- Build the lead shortlist (via `tools/web.md`) and write it to `private/memory/`.
- Draft personalized messages — **The Cold Open**: every opener references something real and
  specific about the recipient. No templated filler, no slop (Principle 9).
- Enrich a local table (better-sqlite3 pattern) now; HubSpot CRM write-back only with
  `$HUBSPOT_PRIVATE_APP_TOKEN`.

## After approval & send
- Log count + channel to `private/state/ledger.md`; update `outreach sent` / `reply rate` in
  `private/state/kpis.md` as replies arrive (measured only).

## Rules
- Personalized + small batches only. No spam, no scraping behind logins.
- Honor unsubscribes immediately; never re-send to a `REJECTED` list.
