---
name: initiate-qa
description: Run exactly ONE bounded cycle of the persistent QA verification lane — sweep the qa queue + context stream, atomically claim one review-status card, verify it from INDEPENDENT evidence via a matched verifier persona, verdict PASS→done / FAIL→back to the acting lane, then record and heartbeat. QA is the only lane that moves review→done. Use when the user says "initiate QA", "run a qa cycle", "/initiate-qa", or the qa lane runner fires this as its headless cycle prompt.
---

# initiate-qa — one QA lane cycle

One bounded cycle; the lane runner loops it, you don't. `roles/qa.md` IS the contract —
this skill adds only the mechanics of a cycle. `CLAUDE.md` hard rules bind throughout.
Core law: an acting lane's status write is a CLAIM; only independently observed evidence
(live URL, screenshot, server state, file content) is evidence.

## 1. Load
Read `roles/qa.md` in full and adopt it. Read `CLAUDE.md` hard rules; have
`tools/verifiers.md` (persona registry) and `tools/verify-goal.md` (generic check) at hand.

## 2. Gate
If `private/state/.lane-qa-pause` exists: run `tools/context.sh heartbeat qa paused`,
report "qa lane paused (sentinel present)" and STOP — a cheap no-op cycle, not an error.

## 3. Sweep (whole queue, never from memory)
- `tools/tasks.sh list-all --tag qa` — ALL statuses.
- `tools/context.sh sweep qa` — unread rows; the claimed card's linked rows give you the
  goal + success criterion — never the verdict.

## 4. Claim & verify (one card per cycle)
- `tools/tasks.sh claim qa` — claims a `review`-status qa-tagged card (it STAYS in review,
  `claimed_by=qa`); empty result = empty queue, not an error.
- **Dispatch a matched verifier persona:** match the card's tags via `tools/verifiers.md`
  and spawn it fresh-context (Agent tool) at the persona's declared model tier. **Graceful
  fallback:** while `tools/verifiers.md` does not exist yet (lands in U11), EVERY card gets
  the generic `tools/verify-goal.md` check — fresh subagent, handed ONLY the goal + the
  verifiable success criterion + how to check (URL/file/SQL), never the actor's narrative.
  Nothing skips review either way.
- **Verdict:**
  - **PASS** → `tools/tasks.sh update <id> done "<evidence one-liner>"` + verdict row:
    `tools/context.sh post qa result "PASS: <evidence observed>" --tags qa,verdict
    --refs '{"card":"<uuid>","evidence":"<url/path>"}'`.
  - **FAIL** → verdict row first (same shape, "FAIL: <concrete gap>"), then restore the
    acting lane's tags MINUS qa (`tools/tasks.sh tag <id> <acting-lane>` — the verb
    replaces, which is what you want here) and `tools/tasks.sh update <id> todo
    "QA FAIL: <gap> — see verdict context row <id>"`.
  - **2 consecutive FAILs on one card** → create a ceo-tagged escalation card
    (`tools/tasks.sh add "ESCALATION: <card> failed QA twice" 3 "<both gaps>" agent ceo`);
    stop bouncing it.
  - **Verifier crashed/timed out** → card STAYS in `review`; post a `blocker` row. A dead
    verifier never silently passes work.
- **Queue empty →** `tools/registry.sh next`, then ONE standing-audit step for that
  venture (live surfaces return 200 + headline, KPIs match raw tables, recent `done`
  cards carry verdict rows). Genuinely nothing viable →
  `tools/context.sh post qa handoff "<escalation>" --tags ceo` — never falsely idle, and
  never a spurious row when there is simply nothing to verify.
- Measurement discipline: any number you repeat comes from its raw table this cycle;
  per-day columns are deltas; unwired source = `n/a`, never a guess.

## 5. Record
- Card statuses + verdict/blocker rows as above (rows carry `--slug` + refs).
- Venture slug worked → `private/state/.current-cycle-slug-qa` (one line, overwrite;
  `company` for whole-board audits).
- ONE ledger digest line to `private/state/ledger.md` via `tools/append.sh` (pending U5 —
  until it exists, append with `>>` only, never editor-style read-modify-write).
- Disposition invariant: never exit half-verified — unfinished verification → the card
  stays `review` with progress notes; never left in a claim you can't stand behind.
- `tools/context.sh heartbeat qa <ok|idle|blocked> "<one-liner>"` — last, always.

## 6. Report
Final message = the cycle report: per card `PASS|FAIL — evidence actually observed`
(quoted text, URL + status, screenshot path) and where it moved; escalations/blockers
raised; metric corrections; what was NOT verified and why (Principle 11).

## Headless deltas (lane runner / `claude -p`)
- No `AskUserQuestion`.
- Gated classes (money / owner's personal identity / mass-cold outbound / destructive —
  rare for QA, but e.g. a paid solve to reach evidence): PENDING appended to
  `private/state/approvals.md` + `tools/context.sh post qa handoff "<gate>" --tags ceo`
  (CEO owns the human card) + `tools/notify.sh` push. Never executed in-cycle.
- Never self-schedule — the runner owns cadence.

## Anti-patterns
- **Passing on the actor's say-so** — reading the doer's notes/logs as evidence.
- **Handing the verifier the narrative** — it gets goal + criterion + how-to-check only.
- **FAIL without the gap named** — "failed" alone bounces work uselessly.
- **Fixing what you found** — you never write the repo; the fix is a FAIL verdict or a
  ceo-tagged proposal.
- **Absence from one failed lookup** — full UUIDs, correct filters, reproduce a second
  way; an HTTP error is "my query failed", not "it doesn't exist".
- **Bouncing a card a third time** instead of escalating to CEO.

## Cost note
Cheap tiers do cheap checks: the persona registry declares the model tier (Haiku for
copy/link checks, Sonnet for browser QA) — dispatch at that tier, not the session default.
One card per cycle; the verifier subagent is the spend, so never dispatch two for one card.
