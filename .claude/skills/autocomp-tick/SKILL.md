---
name: autocomp-tick
description: Run exactly one tick of the autocomp autonomous company — read state, plan via the CEO role, dispatch role subagents, gate any money/send/destructive action through approvals, record everything to the append-only ledger, report, and reschedule. Use when running or resuming the autocomp loop in the autocomp repo, or when the user says "run a tick", "/autocomp", "advance the company", or starts the loop.
---

# autocomp — one tick

You are the company for this tick. Obey `CLAUDE.md` (principles + hard rules) at all times.
Work from the repo root the autocomp repo root. Do exactly one tick, then reschedule.

## 1. Pick the company, then load its context
Run `tools/registry.sh next` (see `tools/registry.md`) — the registry returns the active
company with the highest priority (stalest-first on ties). Work THAT company this tick.
If the registry is unreachable, default to the primary venture and say so.
Write the picked slug to `private/state/.current-tick-slug` (one line, overwrite) so the
harness can attribute this tick's measured token cost (`tools/tick.sh` → `registry.sh logcost`).
Then read its state: `private/charter.md`, `private/state/ledger.md` (last entry),
`private/state/backlog.md`, `private/state/pnl.md`, `private/state/kpis.md`,
`private/state/approvals.md`, and recent `private/memory/*`. Note the current stage and the
tick number (last ledger tick + 1).

## 2. Resolve open approvals
If `private/state/approvals.md` has `PENDING` rows from a prior tick, resolve them FIRST: ask the
human via `AskUserQuestion`. On `APPROVED`, execute the held action now (using the relevant
`tools/*.md`, only if its key exists) and log it. On `REJECTED`, mark it and move on.
**Headless (cron `claude -p` via `tools/tick.sh`):** `AskUserQuestion` is unavailable — check
approvals.md and the kanban for owner edits (`APPROVED`/`REJECTED`/card notes) and act on those
only; everything else stays `PENDING`.
**Kanban approval cards:** batch decisions live as `- [?]` lines on a card the owner answers with
one-tap ✓/✗ (see `tools/tasks.md`). If an approvals.md row points at a card id, run
`tools/tasks.sh get <id>`: each `- [y]` line is APPROVED (execute that item now, per-channel),
`- [n]` is REJECTED, `- [?]` still pending — partial answers are actionable; don't wait for the
whole card. Record outcomes back in approvals.md.

## 2.5 Sync the task board
**Primary: the Supabase kanban** (live at private.limed.tech). Run `tools/tasks.sh list`
(see `tools/tasks.md`), fold tasks with `assignee=agent` into this tick's plan, mark progress
with `tools/tasks.sh update <id> <status> [notes]`, and push anything the human must handle
with `tools/tasks.sh add "<ask>" <prio> "<context>"`. If keys are unset the script exits
non-zero — skip it (never fake it).

**Fallback: the sync doc** (only if the kanban is unreachable). Read the "autocomp — TO-DO"
Google Doc (`SYNC_DOC_ID` in `.env`) via the Drive MCP `read_file_content` (see
`tools/sync-doc.md`); it's read-only from the loop's side. If neither channel is available,
say so — never fake a sync.

The board is a convenience channel, NOT the approval gate — money/send/destructive still go
through §5.

## 3. Plan (CEO) — GTM-first, funnel-driven, never falsely idle
Adopt `roles/ceo.md`. **Measure first:** run `tools/scoreboard.sh` — the funnel (impressions ·
clicks · signups · MRR, from GSC + `metrics_daily`) plus burn-vs-income per venture. Every tick must
be able to name the funnel metric it moved; if it can't, it picked the wrong action.
Then pick the single highest-leverage bounded action via this cascade (a lane is "dry" only when it
genuinely has no move — rare):
- **Lane 1 — GTM/sales (the default; almost always has work).** Steer by **impressions → clicks → MRR**:
  - *Impressions:* a new long-tail page for an uncovered GSC query; submit the next directory/launch
    listing (**bot identity — pre-authorized, just do it**, see Hard rules); re-fire Indexing API +
    IndexNow on anything new; internal-link; refresh + resubmit the sitemap.
  - *Clicks:* GSC high-impression / low-CTR pages → rewrite titles + meta; add FAQ schema for rich results.
  - *MRR:* on-page conversion (CTA, proof, pricing clarity), activation. Warm/personal concierge
    outreach is worth the owner's tap → gate that; the loop keeps building impressions + clicks meanwhile.
- **Lane 2 — improve a current project** (only if Lane 1 is genuinely dry): backlog framework items,
  real fixes, polish, a code/design smell you spotted.
- **Lane 3 — build the next venture** (`private/memory/venture-pipeline-2026-07.md`), one bounded step
  (Rule 17: a new venture needs the Hundred-Dollar Test; a domain or any paid step is GATED).
Produce: `assessment`, 1–3 `actions` each `{role, goal(verifiable), tool, gated}`, `stage_after`,
`report`. Apply the Hundred-Dollar Test on scope. "Everything's gated" only blocks the *outreach*
slice of Lane 1 — bot-identity GTM (listings, SEO/GEO, indexing) is pre-authorized, so never idle
(see `private/memory/loop-scope-not-stuck.md`).

## 4. Dispatch (role subagents)
For each action, launch a subagent via the `Agent` tool (parallel when independent). Give it:
the matching `roles/<role>.md`, the relevant `tools/<tool>.md`, the goal + success criterion,
and the charter excerpt it needs. Each returns a structured result per its role's Output spec.
- **Ungated work executes** (research via `tools/web.md`, local build, deploy-verify, KPI pulls).
- **Gated work does NOT execute** — the subagent returns the prepared spec/draft + `gated:true`.

## 5. Approval gate
**First, do your half (Principle 12).** Before anything goes to the human, decompose each ask
and execute every sub-step the loop CAN do itself with the keys it holds (Cloudflare DNS/Pages,
Supabase admin, repo, deploys) — e.g. write a domain-verification DNS TXT, provision a schema,
ship a page. The card/gate that reaches the human is only the irreducible remainder (a spend, the
human's *personal* identity, a domain-reputation mass-send, a judgment call), with a note of what you
already finished. Don't board work that was yours to complete.

**Bot-identity GTM is NOT gated** (Hard rules): directory/launch submissions, form-fills, listings,
reading communities, publishing our pages/SEO/GEO, indexing — under the boseclaw bot accounts — just
execute. Only the four gated classes stop: money, the human's personal identity, mass/cold email
risking `autocomp.limed.tech`, and destructive actions.

Collect every truly-`gated:true` item (money / personal-identity / domain-reputation send / destructive)
plus anything needing a missing key. Write each to `private/state/approvals.md` as `PENDING`, then ask the human via `AskUserQuestion`
(one question per gate, or grouped). Approved items execute now (if key present) and log;
others stay `PENDING` for next tick. Never execute a gated action without explicit approval.
After writing the `PENDING` row(s), fire one phone push summarizing what's waiting:
`tools/notify.sh "autocomp: N approval(s) pending" "<one-line summary>"` (see `tools/notify.md`).
Best-effort — if `NTFY_TOPIC` is unset it skips; a curl failure is surfaced, never faked.

## 5.5 Independent verify (before you mark anything done)
For each action whose success criterion you're about to check off — and any "done" claim that
isn't a trivial fact you already observed inline — spawn a FRESH, context-less verifier subagent
(`Agent`, general-purpose). Hand it ONLY the goal + its verifiable success criterion + how to
check it (URL to curl, file+grep, SQL/REST). Do NOT hand it your narrative or conclusion — it
must observe reality, not trust the story. It returns PASS/FAIL + the evidence it saw. Mark done
only on PASS; on FAIL keep the item open with the finding and fix or defer it. Batch independent
goals into parallel verifiers. See `tools/verify-goal.md`. (Turn-level twin: §6.5 close-out audit.)

## 6. Record (honest, append-only)
- Append a `## Tick N — <date> — <stage>` block to `private/state/ledger.md`: plan, dispatch, results,
  spend, approvals, learnings. Never edit past entries.
- Update `private/state/backlog.md` (check off met criteria), `private/state/pnl.md` (approved spend/revenue),
  `private/state/kpis.md` (measured only). Write durable learnings/killed ideas to `private/memory/`.
- Use today's date. State what's blocked or skipped — no invented numbers (CLAUDE.md).
- **Deferred follow-ups become agent cards, not just ledger notes.** Any "check the effect in
  N days / verify after X lands" you produce (in ticks AND interactive sessions) goes on the
  board NOW: `tools/tasks.sh add "REMINDER (due <date>): <check>" <prio> "<what to run + what
  outcome means what>" agent`. A ledger note alone is invisible to future ticks' planning —
  the board is the only queue §2.5 re-reads. (Learned 2026-07-07: a GSC re-check lived only in
  the ledger until the owner asked for the reminder himself.)
- **Registry:** `tools/registry.sh log <slug> "<tick summary>" "<key result/verification>"`
  so the multi-venture brain knows when this company was last worked and what happened.

## 6.5 Close-out audit (before reporting)
Run the close-out audit (`tools/done-check.md`), ideally via a spawned reviewer subagent: hard
rules honored; blocked only on the genuinely-irreducible (not self-fixable — see CLAUDE.md #15);
every item touched reflected on the kanban with the right status + a note of what was finished.
Fix what it flags before you stop.

## 7. Report
Print the CEO `report` to the terminal: what happened, what's blocked, what's pending
approval, and the single most decision-relevant signal.

## 8. Reschedule (the heartbeat)
Pick per how the loop was started:
- **Headless cron mode (`tools/tick.sh` — the VPS default):** do NOTHING here. System cron owns
  the cadence; the harness runs `loop-gate.sh record` and logs cost. Your final message = the §7
  report.
- **Default `/loop` heartbeat:** call `ScheduleWakeup` with the same `/autocomp` prompt and a
  sensible delay (idle ticks ~1200–1800s; tighter only if actively watching an external
  result). Stop scheduling if blocked on approvals (wait for the human) or the charter's
  success condition is met.
- **`/goal` mode:** if started under `/goal "<charter success condition>"`, do NOT schedule —
  just finish the turn; the goal evaluator decides whether to run another tick.
- **`CronCreate` mode:** unattended daily — no per-tick scheduling; the cron fires the next one.

Then end the turn. One tick = one heartbeat.
