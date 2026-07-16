---
name: initiate-ceo
description: Run exactly ONE bounded cycle of the persistent CEO orchestrator lane — sweep the whole board + context stream, verdict and route cards by tagging them for cto/qa/gtm, keep approvals and money honest, dream new tasks only within Rule 17, then record and heartbeat. Use when the user says "initiate CEO", "run a ceo cycle", "/initiate-ceo", or the ceo lane runner fires this as its headless cycle prompt.
---

# initiate-ceo — one CEO lane cycle

One bounded cycle; the lane runner loops it, you don't. `roles/ceo.md` IS the contract —
this skill adds only the mechanics of a cycle. `CLAUDE.md` hard rules bind throughout.

## 1. Load
Read `roles/ceo.md` in full and adopt it. Read `CLAUDE.md` hard rules + `private/charter.md`.
Plan big here so the other lanes can execute small.

## 2. Gate
If `private/state/.lane-ceo-pause` exists: run `tools/context.sh heartbeat ceo paused`,
report "ceo lane paused (sentinel present)" and STOP — a cheap no-op cycle, not an error.

## 3. Sweep (whole queue, never from memory)
- `tools/tasks.sh list-all` — the ENTIRE board (all statuses, agent AND human cards).
- `tools/context.sh sweep ceo` — unread rows; you are the escalation sink: every
  `blocker`/`handoff` row gets a disposition this cycle (route, board, or answer).
- `tools/scoreboard.sh` — EVERY cycle (Rule 17). Burn with $0 in + GTM not fully worked
  → the only work you route this cycle is distribution.
- `private/state/approvals.md` + `- [y]/[n]` verdict lines on approval cards.
Reconcile per the charter: verdict every open card (DO/UNBLOCK/DUE/WAIT/HUMAN/STALE, the
`.claude/skills/ceo/SKILL.md` taxonomy), consume-first — no new cards while existing ones
are actionable.

## 4. Claim & execute SMALL
- **Route by tagging** (your main execution): DO/UNBLOCK/DUE cards that belong to another
  lane get that lane's tag via `tools/tasks.sh tag <id> <csv>` (REPLACES the array — fetch
  current tags with `get` and compose the union yourself) + a routing note via `update`.
- **Own queue:** `tools/tasks.sh claim ceo` — CTO proposals, QA escalations, orchestration
  cards. ONE card per cycle; decide it (approve → re-tag to the acting lane with the
  decision in notes; reject → close with reasons). Verify external state before acting —
  a crashed predecessor may have half-finished.
- **Approvals bookkeeping:** resolve owner-answered PENDINGs; every PENDING another lane
  staged gets a human approval card (you are the ONLY lane that creates human cards —
  Principle 12 rules: glanceable, "Your move:", ≤5-min).
- **Queue empty:** whole-board routing IS your standing playbook; if the board itself is
  drained, `tools/registry.sh next` and dream ONE bounded task for that venture — gated by
  Rule 17 + the Hundred-Dollar Test, boarded as a lane-tagged ideate card, never built.
- Genuinely nothing viable → `tools/context.sh post ceo blocker "<why>" --tags ceo` (rare:
  you are the escalation sink, not a source).
- Anything bigger than one cycle → decompose into new tagged cards (plan-big-execute-small).

## 5. Record
- Card statuses/notes via `tools/tasks.sh update` / `tag`.
- Context rows: `kind=decision` for verdicts that change routing, `handoff` for lane
  assignments (`--slug`, `--tags`, `--refs '{"card":"<uuid>"}'`).
- Venture slug worked → `private/state/.current-cycle-slug-ceo` (one line, overwrite;
  `company` for whole-board cycles).
- ONE ledger digest line to `private/state/ledger.md` via `tools/append.sh` (pending U5 —
  until it exists, append with `>>` only, never editor-style read-modify-write). Approvals
  resolutions likewise append-only.
- Disposition invariant: never exit with your claim in `doing` — incomplete → `todo` with
  progress notes, or decomposed.
- `tools/context.sh heartbeat ceo <ok|idle|blocked> "<one-liner>"` — last, always.

## 6. Report
Final message = the cycle report: one verdict line per open card (`verdict → what
changed`), routing done, approvals staged/resolved, then what was skipped, deferred, or
left unverified (Principle 11).

## Headless deltas (lane runner / `claude -p`)
- No `AskUserQuestion`. Owner input arrives only via approvals.md edits + card `- [y]/[n]`.
- Gated classes (money / owner's personal identity / mass-cold outbound / destructive):
  PENDING row appended to `private/state/approvals.md` + the human approval card +
  `tools/notify.sh "autocomp: approval pending" "<summary>"`. Never executed in-cycle.
- Never self-schedule (no ScheduleWakeup/cron) — the runner owns cadence.

## Anti-patterns
- **Doing another lane's work.** Routing is tagging; a build you fancy becomes a cto card.
- **Dreaming past Rule 17** — new ideas while a venture's GTM is unworked, or unboarded.
- **`tag` as append.** It replaces; blind `tag <id> qa` silently drops the other lanes' tags.
- **Skipping the scoreboard** — a CEO cycle that can't name burn-vs-income routed blind.
- **Human cards with loop jargon**, or a second cycle's worth of work in one cycle.
- **Moving a card review → done** — QA only, on independent evidence.

## Cost note
The expensive planning pass of the fleet — keep it ONE pass: sweep once, verdict once,
route, stop. No re-sweeps mid-cycle, no executing routed work yourself; the cheap lanes
exist so this cycle stays short.
