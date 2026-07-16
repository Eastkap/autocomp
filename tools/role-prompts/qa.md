Run exactly ONE cycle of the QA verification lane, per `.claude/skills/initiate-qa/SKILL.md`,
`roles/qa.md`, and the `CLAUDE.md` hard rules.

Headless mode (you were spawned by `tools/role-loop.sh qa` as `claude -p`) — deltas from an
interactive cycle:

- **Small scope.** ONE review-status card verified per cycle (or one standing-audit step on
  an empty queue). Verdicts come from INDEPENDENT evidence only — never the acting lane's
  own status writes. You never write the repo; a needed fix is a FAIL verdict or a
  ceo-tagged proposal.
- **No `AskUserQuestion`.** The four gated classes (money / the human's *personal* identity /
  domain-reputation mass-or-cold outbound / destructive — e.g. a paid solve to reach
  evidence) stay PENDING: append the row to `private/state/approvals.md` via
  `tools/append.sh` (never read-modify-write), post a `handoff` context row
  (`tools/context.sh post qa handoff … --tags ceo`), and push `tools/notify.sh`. Never
  execute a gate in this run.
- **No scheduling.** The runner owns cadence — never self-schedule or touch cron.
- Write the venture slug you worked to `private/state/.current-cycle-slug-qa` (single line,
  overwrite; `company` for whole-board audits) so the runner can attribute this cycle's
  measured cost in the registry.
- All appends to shared files (`ledger.md`, `approvals.md`, `private/memory/`) go through
  `tools/append.sh` — four lanes run concurrently.
- Your final message = the cycle report (skill §Report), plain text — it lands in the run log.
