# tool: kanban task sync (Supabase) — the two-way human↔loop channel

A shared `tasks` board at **auto.limed.tech** (Google-auth, owner-locked). You manage cards
from the browser; the loop syncs from each tick via `tools/tasks.sh` (Supabase REST, service
key). Replaces ad-hoc markdown for live, mobile task hand-off. Setup: `kanban/SETUP.md`.

## Model
- A task row = `{title, description, status, assignee, created_by, priority, notes}`.
- `status`: `todo | doing | blocked | done`. `assignee`: who must act NEXT (`human | agent`).
- **Human → agent:** you add a card (assignee defaults to `agent`) → the loop picks it up.
- **Agent → human:** the loop calls `tasks.sh add` → a card with `assignee=human` appears for you.
- **Agent → agent (self-reminder):** `tasks.sh add "REMINDER (due <date>): <check>" <prio>
  "<what to run + how to read the result>" agent` — a deferred follow-up ("re-check GSC coverage
  on Jul 9") that future ticks pick up via `list`. Ledger notes are NOT re-read by planning; the
  board is. Card notes still address the human too ("Nothing for you right now — I've got this").
- Dragging a card to **Done** in the browser flips assignee to `human` (acknowledged).

## How the tick uses it (wire into the tick, after approvals)
1. **Pull:** `tools/tasks.sh list` → tasks where `assignee=agent` and status in (todo,doing).
   Fold them into the CEO plan as backlog items for this tick.
2. **Work:** act on what's ungated; mark progress with
   `tools/tasks.sh update <id> doing` / `... done "<result>"`.
3. **Push back:** anything needing the human (approval, decision, blocker) →
   `tools/tasks.sh add "<ask>" <priority> "<context>"` AND keep the existing
   `private/state/approvals.md` + ntfy push for money/send/destructive gates (board ≠ approval).

## Card sizing — ≤5 min or subquests (CLAUDE.md #12)
Every human card must be a **single ≤5-minute action**, or a **checklist of ≤5-min subquests** in
the notes. Use markdown checkboxes, one concrete step per line, with the exact link/value/command
inlined so the human executes, not investigates:
```
tools/tasks.sh add "Set TRAWL_URL to your homelab solver" 1 "- [ ] Open .env on the VPS
- [ ] Add the line: TRAWL_URL=http://<your-homelab-ip>:8191
- [ ] Save — the next tick auto-detects it (no restart needed)"
```
The kanban card modal **renders these as a real checklist and lets the human tick each box on
their phone** (toggling rewrites the notes). If a subquest can't get under 5 min, more of it was
probably yours to do first (do it), or it should be several separate cards. A 30-minute vague card
sits untouched; a stack of 2-minute checkboxes gets done.

## Approval cards — one-tap ✓/✗ per item (`- [?]`)
For a batch of gated decisions (e.g. "approve these 10 outreach messages"), write each item as an
**approval line** instead of a checkbox — the modal renders it with **✓ Approve / ✗ Reject** buttons:
```
- [?] D1 · Readwise Discord — <the exact text that would be sent>
```
- The human's tap rewrites the line to `- [y]` (approved) or `- [n]` (rejected); answered items
  show an undo. **When no `- [?]` or `- [ ]` lines remain, the card moves itself to Done.**
- One line = one decision = one exact artifact. Put the verbatim text to be sent/posted in the
  line — the human approves *that text*, not a description of it.
- **Reading verdicts back:** `tools/tasks.sh get <id>` → parse `- [y]` / `- [n]` lines. `[y]` =
  APPROVED for that item (execute it, per-channel), `[n]` = REJECTED (drop it). Record the
  outcome in `private/state/approvals.md` as usual — the card is the owner's approval *surface*;
  approvals.md stays the audit record. Put the card id in the approvals.md row so ticks know
  where to look.

## Rules
- **Service-role key is a secret** → `.env` only (`SUPABASE_SERVICE_KEY`), never in the
  browser, prompts, or git. The browser uses the public anon key (`kanban/config.js`) +
  RLS. (CLAUDE.md secrets vault.)
- The board is a convenience channel, **not** the approval gate. Money/send/destructive
  actions STILL go through `private/state/approvals.md` + `AskUserQuestion` + `tools/notify.sh`.
- If keys are unset, `tasks.sh` exits non-zero and the tick treats kanban sync as a manual
  step — never fake a sync (CLAUDE.md: no invented results).
