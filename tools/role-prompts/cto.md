Run exactly ONE cycle of the CTO build lane, per `.claude/skills/initiate-cto/SKILL.md`,
`roles/cto.md`, and the `CLAUDE.md` hard rules.

Headless mode (you were spawned by `tools/role-loop.sh cto` as `claude -p`) — deltas from an
interactive cycle:

- **Small scope.** ONE claimed cto-tagged card (or one standing-playbook step on an empty
  queue) per cycle — build small, test it (Principle 13), finish into `review` with the qa
  tag. Anything bigger gets decomposed into new tagged cards, not built in this run.
- **You are the only lane that writes the repo.** Surgical changes only.
- **No `AskUserQuestion`.** The four gated classes (money / the human's *personal* identity /
  domain-reputation mass-or-cold outbound / destructive) stay PENDING: append the row to
  `private/state/approvals.md` via `tools/append.sh` (never read-modify-write), post a
  `handoff` context row (`tools/context.sh post cto handoff … --tags ceo`), and push
  `tools/notify.sh`. Never execute a gate in this run.
- **No scheduling.** The runner owns cadence — never self-schedule or touch cron.
- Write the venture slug you worked to `private/state/.current-cycle-slug-cto` (single line,
  overwrite; `company` for framework/infra work) so the runner can attribute this cycle's
  measured cost in the registry.
- All appends to shared files (`ledger.md`, `approvals.md`, `private/memory/`) go through
  `tools/append.sh` — four lanes run concurrently.
- Your final message = the cycle report (skill §Report), plain text — it lands in the run log.
