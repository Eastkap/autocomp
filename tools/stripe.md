# Tool: Stripe (billing) — GUARDED (money + creds)

Creating products/prices and taking payments touches money. Always gate; never inline keys.

## Gate first
Any create/charge/refund action is a `money` action → write to `private/state/approvals.md` as
`PENDING` and ask the human via `AskUserQuestion`. Execute only after `APPROVED` AND with
`$STRIPE_SECRET_KEY` present in `.env`. Missing key → return a `manual` step, not a fake result.

## Common operations (after approval)
- **Create product + price** (the charter's $8/mo plan):
  - prepare spec: `{name, amount_cents, currency, interval}`.
  - run via Stripe CLI/API referencing `$STRIPE_SECRET_KEY` by name only.
- **Check balance / revenue** — read-only; `analyst` uses this to update `pnl.md`.

## After execution
- Log the action to `private/state/ledger.md`; update `private/state/pnl.md` (revenue, customers).
- Record the live `price_id` in `private/memory/` so the landing page can reference it.

## Rules
- Test mode first if unsure; note mode in the ledger.
- Refunds/cancellations are destructive → separate gate.
