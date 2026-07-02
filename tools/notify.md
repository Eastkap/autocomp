# tool: notify (phone push via ntfy.sh)

Real push notifications to the human's phone — the channel for "the loop needs you."
Used primarily at the **approval gate** (CLAUDE.md hard rule): when a tick writes a
`PENDING` row, it should also fire a push so the human can approve from anywhere.

## Why ntfy (not the multiplexer)
Herdr's `notification show` is a local on-screen toast only — no phone delivery. Paseo
has no advertised push. ntfy.sh gives genuine iOS/Android push with zero account: you
subscribe the app to a topic, anything POSTed to that topic pushes to your phone.

## Setup (one-time, human)
1. Install the **ntfy** app (App Store / Play Store).
2. Subscribe to the topic in `.env` under `NTFY_TOPIC` (it's an unguessable string —
   treat it like a secret; anyone with it can publish to your phone).
3. That's it — no login.

## Usage (the loop)
```bash
tools/notify.sh "Title" "Body" [priority] [tags]
```
- `priority`: `min|low|default|high|urgent` (default `high` — approvals should buzz).
- `tags`: emoji shortcodes, e.g. `money_with_wings`, `warning`, `white_check_mark`.

### At the approval gate (the main use)
After writing PENDING rows to `private/state/approvals.md`, fire one push summarizing what's
waiting, e.g.:
```bash
tools/notify.sh "autocomp: 2 approvals pending" \
  "Tick 3 — post 10 outreach drafts; create \$5 Gumroad link" high "warning"
```

## Rules
- The topic is a credential → lives in `.env` as `NTFY_TOPIC`, referenced by name, never
  inlined or committed (CLAUDE.md secrets vault).
- If `NTFY_TOPIC` is unset, `notify.sh` skips quietly (exit 0) — push is best-effort and
  must never crash a tick. A curl failure DOES exit non-zero — surface it, never pretend
  it sent (CLAUDE.md: no invented results).
- Push is a *notice*, not the approval itself. Approval still happens via `AskUserQuestion`
  / editing `private/state/approvals.md`. notify.sh only tells the human to come look.
