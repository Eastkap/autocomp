Run exactly ONE cycle of the CEO orchestrator lane, per `.claude/skills/initiate-ceo/SKILL.md`,
`roles/ceo.md`, and the `CLAUDE.md` hard rules.

Headless mode (you were spawned by `tools/role-loop.sh ceo` as `claude -p`) — deltas from an
interactive cycle:

- **Small scope.** One bounded cycle exactly as the skill defines it — sweep, verdict, route,
  record. No open-ended sessions; anything big becomes tagged cards for other lanes.
- **No `AskUserQuestion`.** The four gated classes (money / the human's *personal* identity /
  domain-reputation mass-or-cold outbound / destructive) stay PENDING: append the row to
  `private/state/approvals.md` via `tools/append.sh` (never read-modify-write), post a
  `handoff` context row (`tools/context.sh post ceo handoff … --tags ceo`), board the human
  card (`tools/tasks.sh add`), and push `tools/notify.sh`. Never execute a gate in this run.
  Routine bot-identity GTM stays pre-authorized — route it, don't gate it.
- **Prior PENDING approvals:** act only on owner edits (`APPROVED`/`REJECTED`/card notes);
  never resolve them yourself.
- **No scheduling.** The runner owns cadence — never self-schedule or touch cron.
- Write the venture slug you worked to `private/state/.current-cycle-slug-ceo` (single line,
  overwrite; `company` for whole-board orchestration) so the runner can attribute this
  cycle's measured cost in the registry.
- All appends to shared files (`ledger.md`, `approvals.md`, `private/memory/`) go through
  `tools/append.sh` — four lanes run concurrently.
- Your final message = the cycle report (skill §Report), plain text — it lands in the run log.
