Run exactly ONE autocomp tick, per `.claude/skills/autocomp-tick/SKILL.md` and `CLAUDE.md`.

Headless mode (you were spawned by cron via `tools/tick.sh` as `claude -p`) — differences
from an interactive tick:

- **No `AskUserQuestion`.** Only the four gated classes (money / the human's *personal* identity /
  domain-reputation mass-or-cold email / destructive) stay `PENDING` in `private/state/approvals.md`
  + one ntfy push (`tools/notify.sh`) + a kanban card (`tools/tasks.sh add`). Never execute those in
  this run. **Routine bot-identity GTM is pre-authorized — execute it** (directory/launch listings,
  form-fills, SEO/GEO, indexing under the boseclaw bot accounts; see CLAUDE.md Hard rules).
- **Prior `PENDING` approvals:** don't try to resolve them interactively. Check
  `private/state/approvals.md` and the kanban for owner edits (`APPROVED` / `REJECTED` /
  card notes) and act only on those.
- **No scheduling.** Do not call ScheduleWakeup or touch cron — the system cron owns the
  cadence. `tools/loop-gate.sh record` is also handled by the harness, not you.
- In §1, right after picking the company, write its slug to
  `private/state/.current-tick-slug` (single line, overwrite) so the harness can attribute
  this tick's token cost in the registry.
- Your final message = the CEO report (§7), plain text — it lands in the run log the owner
  reads.
- **PARALLEL RUN with role lanes (U9 Stage 1, since 2026-07-16).** The persistent role lanes
  (`tools/role-loop.sh`, see `docs/plans/2026-07-15-001-feat-role-agent-lanes-migration-plan.md`)
  run alongside this tick until cutover. Two hard rules for this window:
  (a) **Skip any card with a non-empty `tags` array** — role-tagged cards belong to the lanes
  (they claim atomically; you do not). Treat them as WAIT in your board verdicts, never execute.
  (b) **Write no tracked repo file — and dispatch no repo-writing subagent — whenever the CTO
  lane is unpaused** (i.e. `private/state/.lane-cto-pause` is absent; it was removed 2026-08-01,
  Tick 136). The CTO lane is the single repo writer, and a 24h lane interval means an
  "is its heartbeat fresh?" test would leave the tick believing it was free to write for most of
  every day — two repo writers, which is exactly what the cutover card `8b6275e0` warns against.
  The pause sentinel, not the heartbeat, is the correct signal: absent = CTO owns the repo.
  If the sentinel is present again (CTO re-paused), the tick is the fallback repo writer.
  Either way, `private/` is gitignored, so ledger/approvals/memory work is always allowed —
  through `tools/append.sh` for shared files.
