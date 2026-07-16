Run exactly ONE cycle of the GTM distribution lane, per `.claude/skills/initiate-gtm/SKILL.md`,
`roles/gtm.md`, and the `CLAUDE.md` hard rules.

Headless mode (you were spawned by `tools/role-loop.sh gtm` as `claude -p`) — deltas from an
interactive cycle:

- **Small scope.** ONE claimed gtm-tagged card OR one pre-authorized distribution step
  (directories, SEO/GEO, indexing) per cycle, verified live before it counts. Never a
  build — distribution only.
- **Routine bot-identity GTM is pre-authorized — execute it** (directory/launch listings,
  form-fills, SEO/GEO, indexing under the boseclaw bot accounts; see CLAUDE.md Hard rules).
- **No `AskUserQuestion`.** The four gated classes (money / the human's *personal* identity /
  domain-reputation mass-or-cold outbound / destructive) stay PENDING: append the row to
  `private/state/approvals.md` via `tools/append.sh` (never read-modify-write), post a
  `handoff` context row (`tools/context.sh post gtm handoff … --tags ceo`), and push
  `tools/notify.sh`. Never send a gated send in this run.
- **No scheduling.** The runner owns cadence — never self-schedule or touch cron.
- Write the venture slug you worked to `private/state/.current-cycle-slug-gtm` (single line,
  overwrite; `company` if genuinely cross-venture) so the runner can attribute this cycle's
  measured cost in the registry.
- All appends to shared files (`ledger.md`, `approvals.md`, `private/memory/`) go through
  `tools/append.sh` — four lanes run concurrently.
- Your final message = the cycle report (skill §Report), plain text — it lands in the run log.
