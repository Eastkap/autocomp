---
name: ceo
description: Work the board like the CEO/CTO — read the ENTIRE kanban, make an educated decision on every open card (do now / unblock / wait / human / stale), then EXECUTE the highest-leverage move immediately, invoking any other skill or tool the move needs. Consume-first — drain existing cards before creating new GTM cards or building anything. Use when the owner says "/ceo", "what's the banger move (and do it)", "work the board", "read the kanban and do something", or an interactive session should act instead of report.
---

# ceo — decide on everything, then do the banger move

One interactive pass that ends in *action*, not a menu. Obey `CLAUDE.md` throughout (all
principles + hard rules). This is NOT a tick (`autocomp-tick` owns the heartbeat, ledger
cadence, and registry) — it's the co-founder sitting down, reading the whole board, judging
every card, and executing the single best move right now.

**The consume-first law (the owner's directive, 2026-07-07):** while ANY existing card is
actionable by the loop, the banger move comes from the board. No new GTM cards, no new
pages/features/ventures, no fresh ideation — creation is only allowed once every open card is
genuinely waiting on a date, the human, or an external queue. Draining beats adding; the board
is the backlog we already chose.

## 1. Read everything (never from memory)

- `tools/tasks.sh list-all` — EVERY open card: todo/doing/blocked, agent AND human.
- `tools/agent-task.sh workers` — the home-browser queue: what's queued/claimed/done, and
  whether a worker has claimed anything recently (unclaimed queued jobs = worker down).
- `private/state/approvals.md` — any `PENDING` the owner may have answered (also check `- [y]/[n]`
  verdict lines on approval cards via `tools/tasks.sh get <id>`).
- Today's date vs. every "due/re-poll after <date>" in card notes.
- `tools/scoreboard.sh` — only if you reach §4 (a new pick needs the funnel truth).

## 2. Judge every card — one verdict each, no card skipped

Assign each open card exactly one verdict:

| Verdict | Meaning | What you do with it |
|---|---|---|
| **DO** | Loop-doable now with the keys/tools we hold | Candidate for §3 — execute |
| **UNBLOCK** | Stuck on a dependency *we* can fix (queue a job, install, provision, host a file) | Fix the dependency now — a self-fixable blocker is not a blocker (#15) |
| **DUE** | Date-gated and the date has arrived | Treat as DO |
| **WAIT** | Date-gated (future) or sitting in an external review queue | Leave; note the date it re-enters play |
| **HUMAN** | Irreducible owner action (their identity / spend / send / judgment) | Leave on board; if any sub-step became loop-doable since it was written, do that part and update the card (#12) |
| **STALE** | Overtaken by events, duplicate, or wrongly-scoped | Update or close it with an honest note — a rotting card poisons triage |

Judge honestly: a card parked as WAIT/HUMAN that has a loop-doable half is really UNBLOCK.
That misclassification is the timid failure mode this skill exists to kill.

## 3. Pick the banger move — and execute it

Rank the DO + UNBLOCK + DUE set: binding-constraint first, then the Hundred-Dollar Test
(#6), then whatever other cards depend on. **Then do it — now, in this session**, and keep
chaining through the ranked set as long as the session has room (#18: finish whole tasks,
don't stop at seams).

Invoke whatever the move needs — skills are tools, route freely:
- bot-walled page → `fetch-protected`; interactive logged-in web task → queue via
  `tools/agent-task.sh` (and if the home worker is down, `homelab` to get it up — that's UNBLOCK);
- a fact you lack → `deep-research` / web search; a deploy/DNS/DB step → the matching `tools/*.md`;
- anything else with a matching skill → use it rather than hand-rolling.

Hard rules still hard: money / owner's personal identity / mass-cold send / destructive →
`private/state/approvals.md` as `PENDING` + `tools/notify.sh` push, never executed here.
Bot-identity GTM is pre-authorized — just do it.

## 4. Only if the board is fully drained

Every card WAIT or HUMAN, nothing DO/UNBLOCK/DUE? Then — and only then — invoke `next-move`
for ONE new pick (it runs the Rule-17 distribution-first gate itself), execute its buildable
half, and board the remainder. One pick, not a brainstorm.

## 5. Close out (before you stop)

- Every card touched gets its status + a human-glanceable note updated via `tools/tasks.sh update`
  (5-second-readable, "Your move:" section — CLAUDE.md #12).
- Verify what you claim done against its success criterion (#13); spawn a fresh verifier
  subagent for anything non-trivial (`tools/verify-goal.md`).
- Append what happened to `private/state/ledger.md`; durable learnings → `private/memory/`.
- Run the close-out audit (`tools/done-check.md`).
- Report: one line per card — `verdict → what changed` — then the move(s) executed with
  evidence, then what you did NOT do (#11).

## Anti-patterns
- **Building while the board has open DO cards** — the exact tar pit the consume-first law bans.
- **Reporting a triage instead of acting** — the output of /ceo is changed state, not a table.
- **"Worker is down" filed as WAIT** — if this box (or `homelab`) can start it, it's UNBLOCK.
- **Creating a new card to avoid an old one** — drain, don't reshuffle.
