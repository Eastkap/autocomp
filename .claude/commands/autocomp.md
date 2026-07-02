---
description: Start, resume, or stop the autocomp autonomous-company loop. Usage: /autocomp [start|resume|stop|goal]
---

# /autocomp $ARGUMENTS

Drive the autocomp loop in the autocomp repo root. Each tick is implemented by the
`autocomp-tick` skill. Interpret `$ARGUMENTS`:

- **start** (or empty) — Confirm `private/charter.md` is set, then run the `autocomp-tick` skill once
  (tick 1) and, at the end, schedule the next tick via `ScheduleWakeup` (default heartbeat).
- **resume** — Read the last `private/state/ledger.md` tick and continue: run one tick, reschedule.
- **stop** — Do NOT run a tick. Cancel any scheduled wakeup / `/goal` / cron for autocomp and
  tell the user the loop is paused (state is preserved in `private/state/`).
- **goal** — Run under a completion condition: set `/goal` to the charter's "Definition of
  success", then run `autocomp-tick` repeatedly (no manual ScheduleWakeup) until the evaluator
  confirms success. Use when you want it to run to an end state rather than on an interval.

Always obey `CLAUDE.md` (principles + hard rules). Money / outbound sends / destructive
actions always pause for human approval via `private/state/approvals.md` + `AskUserQuestion`,
regardless of mode.

If `$ARGUMENTS` is unrecognized, default to **start**.
