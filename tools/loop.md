# tool: the in-session hourly loop (self-paced)

How autocomp runs unattended on the VPS: a **self-paced loop inside one Claude Code
session** (not system cron). Each hour the session wakes, checks a timing gate, and
launches at most one tick per 5-hour window — using tail-of-window capacity that would
otherwise reset unused.

## Policy (owner-set)
Launch ONE tick only when BOTH hold:
1. **Window about to reset** — < 1h left in the active 5-hour usage window (`MINS_LEFT <= 60`).
2. **Not already ticked** this window (one task per window).

Otherwise: SKIP, reschedule, do nothing this hour. The idea: the 5h window resets on a
fixed clock and unused capacity is lost, so spend one tick in the tail before it resets.

## Mechanism
- **Driver:** `ScheduleWakeup` (~3600s) re-fires the loop each hour, in this session.
- **Gate:** `tools/loop-gate.sh` reads the real active 5h block via `ccusage` and prints
  `DECISION=TICK|SKIP` + `REASON`. Read-only.
- **On TICK:** run one tick (Skill `autocomp-tick` / `/autocomp resume`), then
  `tools/loop-gate.sh record` to mark the window done so we don't double-tick.
- **On SKIP:** just `ScheduleWakeup` again (~1h).

## Why no token-% cap
ccusage cannot read Anthropic's real per-window rate-limit ceiling, so any "usage %"
against a guessed budget was noise (it read 800%+ against a placeholder and jammed the
gate to permanent SKIP). We dropped it. The gate now triggers purely on the **window
reset clock** (`endTime` from ccusage, which is real). The gate still prints `TOKENS=` for
information so you can eyeball per-window spend — it just doesn't gate on it. If you ever
hit the real rate limit, the tick itself simply fails/waits; there's no fake ceiling.

## Pinging the human
The loop reaches you two ways, both via `tools/notify.sh` (ntfy → phone):
- **Approval gate** (the main one): a tick writes `PENDING` to `private/state/approvals.md` and
  fires a push. Approve by editing that file / replying in the session. See `tools/notify.md`.
- **Blocked tick:** if a tick can't proceed without you (missing key, decision needed), it
  records the block in the ledger and pushes so you know to come look.

Push is best-effort and never fakes a send (CLAUDE.md). If `NTFY_TOPIC` is unset it skips
quietly; a curl failure is surfaced, not hidden.
