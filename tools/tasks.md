# tool: kanban task sync (Supabase) — the two-way human↔loop channel

A shared `tasks` board at **auto.limed.tech** (Google-auth, owner-locked). You manage cards
from the browser; the loop syncs from each tick via `tools/tasks.sh` (Supabase REST, service
key). Replaces ad-hoc markdown for live, mobile task hand-off. Setup: `kanban/SETUP.md`.

## Model
- A task row = `{title, description, status, assignee, created_by, priority, notes}`.
- `status`: `todo | doing | blocked | done`. `assignee`: who must act NEXT (`human | agent`).
- **Human → agent:** you add a card (assignee defaults to `agent`) → the loop picks it up.
- **Agent → human:** the loop calls `tasks.sh add` → a card with `assignee=human` appears for you.
- Dragging a card to **Done** in the browser flips assignee to `human` (acknowledged).

## How the tick uses it (wire into the tick, after approvals)
1. **Pull:** `tools/tasks.sh list` → tasks where `assignee=agent` and status in (todo,doing).
   Fold them into the CEO plan as backlog items for this tick.
2. **Work:** act on what's ungated; mark progress with
   `tools/tasks.sh update <id> doing` / `... done "<result>"`.
3. **Push back:** anything needing the human (approval, decision, blocker) →
   `tools/tasks.sh add "<ask>" <priority> "<context>"` AND keep the existing
   `private/state/approvals.md` + ntfy push for money/send/destructive gates (board ≠ approval).

## Rules
- **Service-role key is a secret** → `.env` only (`SUPABASE_SERVICE_KEY`), never in the
  browser, prompts, or git. The browser uses the public anon key (`kanban/config.js`) +
  RLS. (CLAUDE.md secrets vault.)
- The board is a convenience channel, **not** the approval gate. Money/send/destructive
  actions STILL go through `private/state/approvals.md` + `AskUserQuestion` + `tools/notify.sh`.
- If keys are unset, `tasks.sh` exits non-zero and the tick treats kanban sync as a manual
  step — never fake a sync (CLAUDE.md: no invented results).
