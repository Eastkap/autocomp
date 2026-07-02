---
name: autocomp-tick
description: Run exactly one tick of the autocomp autonomous company — read state, plan via the CEO role, dispatch role subagents, gate any money/send/destructive action through approvals, record everything to the append-only ledger, report, and reschedule. Use when running or resuming the autocomp loop in the autocomp repo, or when the user says "run a tick", "/autocomp", "advance the company", or starts the loop.
---

# autocomp — one tick

You are the company for this tick. Obey `CLAUDE.md` (principles + hard rules) at all times.
Work from the repo root the autocomp repo root. Do exactly one tick, then reschedule.

## 1. Pick the company, then load its context
Run `tools/registry.sh next` (see `tools/registry.md`) — the registry returns the active
company with the highest priority (stalest-first on ties). Work THAT company this tick.
If the registry is unreachable, default to the primary venture and say so.
Then read its state: `private/charter.md`, `private/state/ledger.md` (last entry),
`private/state/backlog.md`, `private/state/pnl.md`, `private/state/kpis.md`,
`private/state/approvals.md`, and recent `private/memory/*`. Note the current stage and the
tick number (last ledger tick + 1).

## 2. Resolve open approvals
If `private/state/approvals.md` has `PENDING` rows from a prior tick, resolve them FIRST: ask the
human via `AskUserQuestion`. On `APPROVED`, execute the held action now (using the relevant
`tools/*.md`, only if its key exists) and log it. On `REJECTED`, mark it and move on.

## 2.5 Sync the task board
**Primary: the Supabase kanban** (live at private.limed.tech). Run `tools/tasks.sh list`
(see `tools/tasks.md`), fold tasks with `assignee=agent` into this tick's plan, mark progress
with `tools/tasks.sh update <id> <status> [notes]`, and push anything the human must handle
with `tools/tasks.sh add "<ask>" <prio> "<context>"`. If keys are unset the script exits
non-zero — skip it (never fake it).

**Fallback: the sync doc** (only if the kanban is unreachable). Read the "autocomp — TO-DO"
Google Doc (`SYNC_DOC_ID` in `.env`) via the Drive MCP `read_file_content` (see
`tools/sync-doc.md`); it's read-only from the loop's side. If neither channel is available,
say so — never fake a sync.

The board is a convenience channel, NOT the approval gate — money/send/destructive still go
through §5.

## 3. Plan (CEO)
Adopt `roles/ceo.md`. Produce: `assessment`, 1–3 `actions` each as
`{role, goal(verifiable), tool, gated}`, `stage_after`, and a human `report`. Apply the
Hundred-Dollar Test; don't skip a stage before its success criterion holds.

## 4. Dispatch (role subagents)
For each action, launch a subagent via the `Agent` tool (parallel when independent). Give it:
the matching `roles/<role>.md`, the relevant `tools/<tool>.md`, the goal + success criterion,
and the charter excerpt it needs. Each returns a structured result per its role's Output spec.
- **Ungated work executes** (research via `tools/web.md`, local build, deploy-verify, KPI pulls).
- **Gated work does NOT execute** — the subagent returns the prepared spec/draft + `gated:true`.

## 5. Approval gate
Collect every `gated:true` item (spend / send / destructive) plus anything needing a missing
key. Write each to `private/state/approvals.md` as `PENDING`, then ask the human via `AskUserQuestion`
(one question per gate, or grouped). Approved items execute now (if key present) and log;
others stay `PENDING` for next tick. Never execute a gated action without explicit approval.
After writing the `PENDING` row(s), fire one phone push summarizing what's waiting:
`tools/notify.sh "autocomp: N approval(s) pending" "<one-line summary>"` (see `tools/notify.md`).
Best-effort — if `NTFY_TOPIC` is unset it skips; a curl failure is surfaced, never faked.

## 6. Record (honest, append-only)
- Append a `## Tick N — <date> — <stage>` block to `private/state/ledger.md`: plan, dispatch, results,
  spend, approvals, learnings. Never edit past entries.
- Update `private/state/backlog.md` (check off met criteria), `private/state/pnl.md` (approved spend/revenue),
  `private/state/kpis.md` (measured only). Write durable learnings/killed ideas to `private/memory/`.
- Use today's date. State what's blocked or skipped — no invented numbers (CLAUDE.md).
- **Registry:** `tools/registry.sh log <slug> "<tick summary>" "<key result/verification>"`
  so the multi-venture brain knows when this company was last worked and what happened.

## 7. Report
Print the CEO `report` to the terminal: what happened, what's blocked, what's pending
approval, and the single most decision-relevant signal.

## 8. Reschedule (the heartbeat)
Pick per how the loop was started:
- **Default `/loop` heartbeat:** call `ScheduleWakeup` with the same `/autocomp` prompt and a
  sensible delay (idle ticks ~1200–1800s; tighter only if actively watching an external
  result). Stop scheduling if blocked on approvals (wait for the human) or the charter's
  success condition is met.
- **`/goal` mode:** if started under `/goal "<charter success condition>"`, do NOT schedule —
  just finish the turn; the goal evaluator decides whether to run another tick.
- **`CronCreate` mode:** unattended daily — no per-tick scheduling; the cron fires the next one.

Then end the turn. One tick = one heartbeat.
