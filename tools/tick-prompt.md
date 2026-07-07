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
