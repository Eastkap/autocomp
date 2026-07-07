# tool: the heartbeat — cron + headless `claude -p` ticks

How autocomp runs unattended on the VPS: **system cron fires `tools/tick.sh` hourly**; the
script checks a timing gate and, roughly every 5 hours, spawns ONE fresh headless tick
(`claude -p` reading `tools/tick-prompt.md`). No long-lived session, no self-scheduling chain.

## Policy (owner-set, 24/7 since 2026-07-04)
Launch ONE tick when: **≥ ~5h have passed since the last recorded tick** (`LOOP_INTERVAL_HOURS`,
default 5; threshold = interval − 30min so the hourly cron reliably catches it). Runs regardless
of whether Claude is otherwise in use — the tick creates its own usage. Otherwise the cron run
exits quietly.

Why time-based (not window-tail): the earlier gate only fired in the last hour of an *active*
ccusage window, so during genuine idle (nothing using Claude overnight) no window existed and it
SKIP'd forever — observed as a ~day-long stall 07-03→04. Time-based never stalls: the loop
progresses 24/7. Cost: ~4–5 ticks/day. If you're rate-limited when a tick fires it just fails and
the next hourly cron retries.

## Mechanism
- **Driver:** user crontab — `5 * * * * tools/tick.sh >> private/state/tick-cron.log 2>&1`.
- **Gate:** `tools/loop-gate.sh` compares now vs. the `.loop-last-tick` stamp, prints
  `DECISION=TICK|SKIP`. Read-only, no ccusage dependency.
- **On TICK:** `tick.sh` spawns `claude -p "$(cat tools/tick-prompt.md)" --output-format json`
  (90-min timeout, flock against overlap), then `loop-gate.sh record`, then logs the tick's
  MEASURED cost (`total_cost_usd` + token counts from the result JSON) to
  `private/state/tick-costs.log` and `registry.sh logcost <slug>` — the slug comes from
  `private/state/.current-tick-slug`, written by the tick itself (SKILL.md §1). Exact
  per-tick, per-company cost — no ccusage guessing.
- **On failure:** window is NOT recorded (the next hourly cron may retry it) + ntfy push.
- **Run artifacts:** full result JSON per run under `private/state/tick-runs/` (gitignored).
- **Permissions:** headless runs rely on the allowlist in `.claude/settings.json`
  (broad tools + explicit denies: no sudo, no force-push, no `.env` reads into context).
  The REAL safety line stays the constitution's approval gate inside the tick.
- **Watchdog (unchanged):** `tools/watchdog.sh` (cron, */30) alerts via ntfy if no tick was
  recorded for > `WATCHDOG_MAX_HOURS` — now it guards cron itself.

## Why fresh processes beat one long session (migrated 2026-07-02)
- cron doesn't lapse; the old ScheduleWakeup chain silently died once (~19h gap).
- Ticks are ~5h apart → prompt cache is cold either way; a fresh minimal context is cheaper
  than re-reading a long conversation.
- `claude -p --output-format json` reports exact usage/cost → per-venture accounting for the
  HQ dashboard.
- Same architecture the managed tier ("run by us") needs anyway.

## Interactive sessions
An interactive Claude Code session in this repo is for co-founder work (chat, approvals,
builds) and must NOT also run the heartbeat — the gate's already-ticked marker prevents
double-ticking if both exist. The legacy in-session mode (ScheduleWakeup loop) remains valid
as a fallback; see git history of this file for its full description.

## Headless approvals
`AskUserQuestion` doesn't exist in a headless tick. The gate flow is: tick writes `PENDING`
to `private/state/approvals.md` + kanban card + ntfy push → owner edits the file / the card
(APPROVED/REJECTED) → the NEXT tick executes approved items. Same hard rules, one-tick latency.

## Why no token-% cap
ccusage cannot read Anthropic's real per-window rate-limit ceiling, so any "usage %" against
a guessed budget was noise (it read 800%+ against a placeholder and jammed the gate to
permanent SKIP). The gate triggers purely on the **window reset clock** (`endTime` from
ccusage, which is real). If we ever hit the real rate limit, the tick itself fails and the
window is retried — there's no fake ceiling.
