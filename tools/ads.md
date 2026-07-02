# Tool: Ads (Meta / Google) — GUARDED (money)

Any ad creation or funding is a `money` action. Prepare briefs freely; never launch or fund
without approval and the matching token.

## Gate first
Creating/funding/scaling a campaign → `private/state/approvals.md` `PENDING` + `AskUserQuestion`.
Execute only after `APPROVED` AND with the token present (`$META_ADS_ACCESS_TOKEN` /
`$GOOGLE_ADS_DEVELOPER_TOKEN`). Missing token → `manual` step.

## What you can do ungated
- Build a **campaign brief**: objective, audience, creative concept + copy, daily budget,
  success metric, and **kill criteria** (when to stop). Respect charter spend cap + Hundred-
  Dollar Test.
- Research existing ads (competitor ad libraries) via `tools/web.md` (read-only).

## After approval & launch
- Log spend to `private/state/pnl.md` + `private/state/ledger.md`.
- Hand KPI hooks to `analyst` (CTR, CPC, signups attributed via PostHog UTMs).

## Rules
- Start with the smallest viable test (one ad set). Never propose > charter per-approval cap.
- Note: as of the whitepaper, some channels' automation (e.g. Google Search Ads) may need
  manual setup — surface that honestly rather than pretending.
