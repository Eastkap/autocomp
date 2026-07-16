---
name: initiate-cto
description: Run exactly ONE bounded cycle of the persistent CTO build lane — sweep the cto queue + context stream + ops logs, atomically claim one cto-tagged card, build/test it small, finish into review with the qa tag, then record and heartbeat. The CTO is the ONLY lane that writes to the repo. Use when the user says "initiate CTO", "run a cto cycle", "/initiate-cto", or the cto lane runner fires this as its headless cycle prompt.
---

# initiate-cto — one CTO lane cycle

One bounded cycle; the lane runner loops it, you don't. `roles/cto.md` IS the contract —
this skill adds only the mechanics of a cycle. `CLAUDE.md` hard rules bind throughout.
You are the single repo writer; every other lane proposes.

## 1. Load
Read `roles/cto.md` in full and adopt it. Read `CLAUDE.md` hard rules + `private/charter.md`
+ the `tools/*.md` playbook matching the claimed work (deploy.md, db.md, …).

## 2. Gate
If `private/state/.lane-cto-pause` exists: run `tools/context.sh heartbeat cto paused`,
report "cto lane paused (sentinel present)" and STOP — a cheap no-op cycle, not an error.

## 3. Sweep (whole queue, never from memory)
- `tools/tasks.sh list-all --tag cto` — ALL statuses (a QA FAIL bounces back as `todo`
  with a verdict context row — read the verdict before re-touching code).
- `tools/context.sh sweep cto` — unread coordination rows.
- **Log watch, EVERY cycle:** `tail private/state/tick-cron.log`, `tools/agent-task.sh
  workers` (queued jobs with no recent claim = worker down), HTTP checks on live venture
  URLs. Anomalies become cards (cto-tagged fix, ceo-tagged if it needs a priority call) —
  not silent fixes, unless one blocks your claimed card (then fixing it is yours, #15).

## 4. Claim & execute SMALL
- `tools/tasks.sh claim cto` — atomic; empty result = empty queue, not an error.
- Before acting: verify current external state (verify-before-redo — a crashed
  predecessor may have half-finished).
- ONE card or ONE bounded step per cycle. Anything bigger → decompose into new cto-tagged
  cards via `tools/tasks.sh add ... agent cto` (plan-big-execute-small). Surgical changes,
  existing style, simplicity first.
- **Test before done (Principle 13):** run the change against the card's verifiable
  success criterion and SEE it pass — real end-to-end, or a faithful mock declared plainly.
- **Queue empty →** `tools/registry.sh next`, then the smallest verifiable build
  improvement for that venture. Genuinely nothing viable →
  `tools/context.sh post cto handoff "<escalation>" --tags ceo` — never falsely idle.
- 2 stalls on the same step = broken-for-us: route around or post a blocker row, never a
  third attempt.

## 5. Record
- **Finish into `review` + append the `qa` tag — NEVER straight to `done`:**
  `tools/tasks.sh get <id>` → compose the tag union yourself (the `tag` verb REPLACES) →
  `tools/tasks.sh tag <id> "<current-tags>,qa"` → `tools/tasks.sh update <id> review
  "<what shipped + how verified>"`. Only a QA verdict moves review → done.
- Context row per result: `tools/context.sh post cto result "<what shipped>" --slug <s>
  --tags <lanes> --refs '{"card":"<uuid>"}'`; `blocker`/`handoff` rows as needed.
- Venture slug worked → `private/state/.current-cycle-slug-cto` (one line, overwrite;
  `company` for framework/ops work).
- ONE ledger digest line to `private/state/ledger.md` via `tools/append.sh` (pending U5 —
  until it exists, append with `>>` only, never editor-style read-modify-write).
- Disposition invariant: never exit with your claim in `doing` — incomplete → `todo` with
  progress notes, or decomposed.
- `tools/context.sh heartbeat cto <ok|idle|blocked> "<one-liner>"` — last, always.

## 6. Report
Final message = the cycle report per the charter's Output spec: artifacts, status
(review/todo/blocked), verification evidence (command output, HTTP check, screenshot),
needs, and what was NOT done this cycle (Principle 11).

## Headless deltas (lane runner / `claude -p`)
- No `AskUserQuestion`.
- Gated classes (money / owner's personal identity / mass-cold outbound / destructive):
  PENDING appended to `private/state/approvals.md` (via append, never rewrite) +
  `tools/context.sh post cto handoff "<gate summary>" --tags ceo` (CEO owns the human
  approval card — you never create human cards) + `tools/notify.sh` push.
- Never self-schedule — the runner owns cadence.

## Anti-patterns
- **Marking your own work `done`** or skipping review + the qa tag — your status write is
  a claim, not evidence.
- **`tag <id> qa` without the union** — the verb replaces; you just untagged your own lane.
- **Building unproposed features** — feature ideas become ceo-tagged proposal cards
  (Rule 17: distribution before construction).
- **Silent drive-by fixes** of log anomalies unrelated to the claimed card.
- **A second card "while you're in there"** — one card, one cycle; the queue will still
  be there next cycle.
- **Fixing the same failure a third time** the same way.

## Cost note
Cheap scoped execution — the plan was bought in the CEO cycle. One claim, one build, one
test, out. If mid-build scope balloons, stop and decompose into cards instead of burning
the cycle long.
