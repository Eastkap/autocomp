---
title: "feat: Migrate autocomp to persistent role-agent lanes (paperclip-inspired)"
type: feat
status: active
date: 2026-07-15
---

# feat: Migrate autocomp to persistent role-agent lanes (paperclip-inspired)

## Summary

Replace the single ~5-hourly monolithic tick with four always-on **role lanes** — CEO, CTO, QA, GTM — each started by an `initiate-<role>` skill and kept alive by a lane-runner script that repeatedly spawns **bounded headless cycles** (plan big, execute small). Lanes coordinate through **tagged Supabase records** (role-tagged kanban cards with atomic claim, plus an insert-only shared context store) instead of the single `ledger.md`, every completed card is double-checked by a **model-tiered verifier persona** before it counts as done, and the lanes are supervised interactively as four **herdr** terminal tabs with a headless VPS fallback.

---

## Problem Frame

Today the whole company advances once every ~5 hours in one serialized tick: one `claude -p` session plans as CEO, dispatches ephemeral role subagents, and appends to one ledger file. That shape caps throughput (build, QA, and distribution wait on each other), makes multi-venture work collide on the single `private/state/*` files, and gives roles no continuity between ticks. The paperclip.ing model (DB-backed tickets with atomic checkout, heartbeat-triggered agents, org-chart roles, human as governance gatekeeper) and the "plan big, execute small" cookbook pattern (one expensive planning pass, many cheap scoped executions) point at the target shape.

---

## Assumptions

*This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input — un-validated bets that should be reviewed before implementation proceeds.*

- **"Agents running 24/7 without a loop" is implemented as supervised lane runners spawning bounded `claude -p` cycles, not one never-ending Claude session per tab.** This repo's own history (`tools/loop.md`) shows long-lived sessions die silently (~19h gap once) and lose the per-run cost JSON that feeds the scoreboard. Paperclip itself works this way too (heartbeat queue wakes agents; it does not hold persistent model loops). The herdr tab still shows one continuously-running lane process; what recycles inside it is each Claude cycle.
- **"Randomly selects a project" is implemented as a staleness-biased weighted pick** over active ventures in `autocomp.companies` (extending `tools/registry.sh next`), not uniform random — pure random can starve a venture; the registry already encodes priority + staleness.
- **The lane set is exactly CEO, CTO, QA, GTM.** Existing `roles/*.md` personas (builder, analyst, cfo, marketer, sales) are folded in as dispatchable sub-personas: builder→CTO, marketer/sales→GTM, analyst→QA/CEO, cfo→CEO (approvals bookkeeping).
- **"herder" = herdr** (`github.com/ogulcancelik/herdr`, herdr.dev) — the Rust terminal multiplexer for running multiple CLI agents in panes. It is the supervision/observability surface only, not the orchestration layer; tmux/systemd is the fallback where herdr isn't installed (e.g. the VPS).
- **`ledger.md` stays as the append-only audit file but is demoted to a per-lane digest**, written at the end of each cycle; operational cross-agent coordination moves to insert-only Supabase rows. `tools/registry.md` already declares this split ("the ledger stays the authoritative audit record — the registry is the operational index").
- **CTO is the only lane that writes to the repo** (single-writer rule). CEO/QA/GTM write to Supabase, the board, and external surfaces only. This avoids concurrent git conflicts without introducing per-lane worktrees yet.
- **The four hard gates (spend / personal identity / cold outbound / destructive) are unchanged** and enforced per-lane; approval state does not propagate implicitly between lanes (`private/memory/worker2-reputation-gate.md`).
- The Anthropic Managed Agents API from the cookbook is used as a **cost/architecture pattern** (planner + cheap scoped executions), not adopted as a runtime — autocomp stays on local `claude -p` + Supabase.

---

## Requirements

- R1. Four role lanes (CEO, CTO, QA, GTM) can each run 24/7, each started by its own `initiate-<role>` skill and restartable after crash without manual cleanup.
- R2. Kanban cards carry role tags; a lane claims tagged work **atomically** so two lanes/cycles never grab the same card.
- R3. A shared, tagged, **insert-only** context store in Supabase is readable/writable by all lanes and replaces `ledger.md` as the coordination medium; `ledger.md` remains the append-only audit digest.
- R4. Work selection per cycle: (a) claim cards tagged for the role; (b) if the lane's queue is empty, pick a project (staleness-biased) and do that role's standing playbook for it — a lane must never falsely idle (`private/memory/loop-scope-not-stuck.md`).
- R5. CEO lane orchestrates: reads the whole board and context stream, routes work by tagging cards for other lanes, ideates ("dreams") new tasks — bounded by Rule 17 (distribution-first) and the Hundred-Dollar Test — and owns approvals bookkeeping.
- R6. CTO lane builds features, watches logs (tick/lane logs, worker queues, deploy health), and proposes new features as tagged cards (e.g. directory badges on venture pages) rather than building them silently past Rule 17.
- R7. QA lane verifies claims from **independent evidence** (screenshots, server state, live URLs) — never from the acting lane's own status writes (`private/memory/flow-written-status-verify.md`) — and flips card status accordingly.
- R8. GTM lane executes distribution playbooks under the pre-authorized bot identity (directories, SEO/GEO, indexing) and stages gated sends as PENDING approvals.
- R9. Measured token/cost accounting keeps flowing per cycle per lane into the registry (`autocomp.activity` with a lane actor), so `tools/scoreboard.sh` and Rule 17 stay live.
- R10. Each lane stamps a liveness heartbeat; the watchdog alerts (ntfy) when any lane is stale; the lane runner restarts failed cycles with backoff.
- R11. Hard rules preserved: approval gates, secrets by name, no invented results, append-only audit.
- R12. Total spend is bounded: per-lane cycle intervals plus a daily burn cap that pauses lanes when exceeded.
- R13. **Reliability:** no single point of silent failure — every lane, cycle, and claimed card has a bounded lifetime and an observer: cycles time out, crashed cycles leave no stuck `doing` cards, stale lanes alert, and a machine reboot brings all lanes back without manual steps.
- R14. **Scalability:** adding a fifth lane or a new venture is configuration + a charter file, not code changes — the runner, claim RPC, context store, watchdog, and scoreboard are role- and venture-agnostic (role/slug are data, never hardcoded).
- R15. **Every completed task is double-checked before it counts as done:** completed cards enter a `review` state, and a matched verifier subagent from a persona registry — run at the cheapest capable model tier (e.g. Haiku enforcing copywriting/anti-slop rules on text, Sonnet driving browser QA and monkey-testing on shipped features) — must PASS with recorded evidence; FAIL sends the card back to the acting lane with the evidence attached.

---

## Scope Boundaries

- Not adopting the paperclip codebase (server/UI/adapters) — only its mechanisms (atomic checkout, heartbeat wake-ups, budget checks, human-as-gatekeeper).
- Not migrating to the Anthropic Managed Agents API; the runtime stays `claude -p` + Supabase.
- No new ventures, venture features, or kanban UI redesign beyond role-tag chips and lane-status display (Rule 17 applies to this build too: the GTM lane going live *is* the distribution win).
- No per-lane git worktrees in v1 (single-writer CTO instead).
- Homelab workers (trawl-worker, agent-worker) are untouched; they keep their Supabase queues.

### Deferred to Follow-Up Work

- Refining the homelab box into additional loopable lanes (e.g. a browser-heavy GTM executor lane running locally): future iteration once the four VPS lanes are stable.
- Per-venture `private/` separation (per-venture charters/backlogs): follow-up once lanes prove out; v1 keeps the single `private/` with venture context in Supabase.
- herdr socket-API integration (agents spawning panes / cross-pane coordination): unverified API surface; revisit after v1.
- Retiring `roles/{builder,analyst,cfo,marketer,sales}.md` files entirely — v1 keeps them as sub-persona prompts.

---

## Context & Research

### Relevant Code and Patterns

- `tools/tick.sh`, `tools/loop-gate.sh`, `tools/tick-prompt.md`, `tools/watchdog.sh`, `tools/loop.md` — the current tick machinery; the lane runner generalizes this shape (flock, gate, bounded `claude -p`, cost harvest from result JSON, ntfy on failure).
- `tools/tasks.sh` + `kanban/schema.sql` + `kanban/app.js` — kanban surface; `public.tasks` today has `assignee ∈ (human,agent)`, no tags.
- `tools/agent-task.sh` + `claim_agent_job(p_worker, p_identities)` RPC and the trawl `claim_solve_job` RPC — the proven `FOR UPDATE SKIP LOCKED` atomic-claim pattern to copy for role-tag claiming.
- `tools/registry.sh` (`autocomp.companies`, `autocomp.activity`, `logcost`, `next`) and `tools/scoreboard.sh` — venture registry, cost accounting, Rule 17 enforcement.
- `.claude/skills/ceo/SKILL.md` — the closest existing template for a role loop cycle (read whole board → verdict per card → consume-first → execute → close-out).
- Client conventions: bash + curl PostgREST with `SUPABASE_SERVICE_KEY`, `Accept-Profile`/`Content-Profile` headers for non-public schemas, loud non-zero exit when keys are missing, one verb-subcommand CLI per surface paired with a `tools/*.md` playbook.

### Institutional Learnings

- `tools/loop.md` — self-scheduling long sessions died silently; cron-fired fresh processes + watchdog fixed it; never gate on unmeasurable numbers; flock against overlap.
- `private/memory/consume-the-whole-queue.md` — sweep the entire queue each cycle, don't replay memory of it.
- `private/memory/loop-scope-not-stuck.md` — single-lane loops falsely idle; every lane needs a priority cascade + CEO escalation.
- `private/memory/flow-written-status-verify.md` — actor-written status is a claim, not evidence (QA charter).
- `private/memory/verify-subagent-board-writes.md` — HTTP error ≠ absence; full UUIDs; reproduce absence claims a second way before accusing another agent.
- `private/memory/worker2-reputation-gate.md` + `homelab-worker-2-agentic-browser.md` (user memory) — gates are local per agent; capability-filtered claim RPCs enforce identity least-privilege.
- `private/memory/daily-metrics-are-deltas.md` — check how consumers aggregate before writing any metric row.
- `private/memory/oauth-hang-route-around-via-github.md` — 2 stalls on the same step = broken-for-us; never queue a third identical attempt.

### External References

- Paperclip — https://github.com/paperclipai/paperclip and https://paperclip.ing/ — DB-backed control plane: heartbeat queue (coalescing, budget checks, secret injection) wakes agents; work items are tickets with atomic checkout and blocking dependencies; goal ancestry embedded per task; human approves hires/strategy and can pause any agent.
- Plan big, execute small — https://github.com/anthropics/claude-cookbooks/blob/main/managed_agents/CMA_plan_big_execute_small.ipynb — one frontier planning pass decomposes work; many cheap scoped workers execute in parallel (measured 2.5× cheaper / 3× faster than one big session on their benchmark).
- herdr — https://github.com/ogulcancelik/herdr and https://herdr.dev/docs/agents/ — Rust terminal multiplexer for parallel CLI agents; per-agent TOML detection manifests classify idle/working/blocked; survives SSH disconnects.

---

## Key Technical Decisions

- **Lane = supervisor script + bounded cycles, not one long session**: preserves measured cost per cycle (result JSON), crash containment, and warm restart — while still presenting as a 24/7 agent in a herdr tab. (Paperclip's heartbeat model, repo's own loop history.)
- **Role routing via a `tags text[]` column + `claim_task(p_role)` RPC** copying the existing `FOR UPDATE SKIP LOCKED` claim shape: concurrency safety for free, no double-work (R2), and human cards stay untouched (`assignee='human'` is never claimed).
- **Shared context = new insert-only `autocomp.context` table** (lane, venture slug, tags[], kind, body, refs) rather than overloading `autocomp.activity`: activity stays the metrics/cost index; context carries coordination narrative. Agents get INSERT+SELECT only — append-only enforced by grants, not convention.
- **Per-lane cadence + daily burn cap** (`LANE_INTERVAL_*`, `DAILY_BURN_CAP_USD` checked against `autocomp.activity` before each cycle): Paperclip's budget-check-before-wake, and the concrete answer to "4 lanes × 24/7" token risk.
- **Plan big, execute small inside each cycle**: the CEO lane does the expensive planning/routing pass; CTO/QA/GTM cycles are cheap, tightly scoped executions of already-tagged cards. Cycle prompts instruct one-card-or-one-playbook scope, not open-ended sessions.
- **Old tick stays running until cutover** (parallel operation, then cron swap): the migration is reversible at every phase; `tools/tick.sh` survives as `FORCE=1` fallback.
- **DDL is committed this time** (`tools/sql/`): the `solve_jobs`/`agent_jobs` DDL was provisioned ad-hoc and never committed — flagged as a smell; this migration commits its schema.
- **Roles and ventures are data, not code**: `role-loop.sh`, `claim_task`, the context store, watchdog, and scoreboard all take the role/slug as a parameter. A fifth lane (say, a local homelab lane) is a new charter + prompt + one more runner invocation — nothing else changes. This is the scale contract (R14) and mirrors paperclip's user-defined org chart.
- **Verification is a persona registry, not one QA prompt** (ce-plugin-style): each check type is its own small verifier persona file with a declared model tier — copy-check (Haiku: copywriting rules, vibecoded-design-tells anti-slop checklist), site-QA (Sonnet: drive the live page via Playwright, screenshot evidence), monkey-test (Sonnet: unscripted interaction fuzz on new features), link/deploy check (Haiku: HTTP + content assertions). The QA lane matches card tags to a persona and dispatches it fresh-context (extends `tools/verify-goal.md`); cheap checks stay cheap, and adding a check type is one new persona file (R14's config-only contract applied to verification).

---

## Open Questions

### Resolved During Planning

- Persistent sessions vs. recycled cycles: recycled cycles (see Assumptions; repo history + paperclip both point here).
- Where tags live: on `public.tasks` as `tags text[]` (minimal migration, kanban UI reads same table) rather than a new tickets table.
- Ledger fate: demoted to audit digest, coordination moves to `autocomp.context` (registry.md already declared the split).

### Deferred to Implementation

- Exact per-lane default intervals (start conservative — e.g. GTM 1h, CEO 2h, CTO 2h, QA 2h, keeping GTM's cadence ≥ CTO's so distribution never cycles slower than construction (Rule 17) — and tune against the scoreboard): needs observed burn data.
- Whether GTM cycles need the homelab agent-worker queue for browser-heavy flows or can drive Camoufox from the VPS lane directly: decided per playbook at execution time.
- herdr detection-manifest tuning for `claude` CLI state classification: only knowable against the live TUI.
- Whether the CEO lane fully absorbs `.claude/skills/ceo` (interactive skill) or the two share a common reference file: decide when writing the skills to avoid drift.

---

## Output Structure

    tools/
      sql/
        2026-07-15-role-lanes.sql      # tasks.tags, claim_task RPC, autocomp.context, autocomp.lanes
      context.sh                        # post/read/sweep the shared context store
      context.md                        # playbook for the context store
      role-loop.sh                      # lane runner: gate → bounded claude -p cycle → cost harvest → heartbeat
      role-prompts/
        ceo.md  cto.md  qa.md  gtm.md   # headless cycle prompts (thin: point at initiate-<role> skill)
      herder.md                         # herdr setup + tmux/systemd fallback playbook
      verifiers.md                      # registry playbook: tag→persona matching, model tiers, verdict contract
      append.sh                         # flock-wrapped append helper for shared files (ledger, approvals)
    roles/
      cto.md  qa.md  gtm.md             # new lane charters (ceo.md rewritten)
      verifiers/
        copy-check.md  site-qa.md  monkey-test.md  link-check.md
                                        # verifier personas, each with a declared model tier
    .claude/skills/
      initiate-ceo/SKILL.md
      initiate-cto/SKILL.md
      initiate-qa/SKILL.md
      initiate-gtm/SKILL.md

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
flowchart LR
  subgraph supervision [herdr tabs — tmux/systemd fallback]
    CEO[role-loop.sh ceo]
    CTO[role-loop.sh cto]
    QA[role-loop.sh qa]
    GTM[role-loop.sh gtm]
  end

  CEO -- "bounded claude -p cycle" --> C1[initiate-ceo skill]
  CTO --> C2[initiate-cto skill]
  QA --> C3[initiate-qa skill]
  GTM --> C4[initiate-gtm skill]

  subgraph supabase [Supabase]
    TASKS[(public.tasks + tags[] + claim_task RPC)]
    CTX[(autocomp.context — insert-only, tagged)]
    LANES[(autocomp.lanes — heartbeats)]
    ACT[(autocomp.activity — cost per cycle per lane)]
    REG[(autocomp.companies — venture pick)]
  end

  C1 & C2 & C3 & C4 -->|claim / tag / update| TASKS
  C1 & C2 & C3 & C4 -->|insert narrative| CTX
  supervision -->|stamp per cycle| LANES
  supervision -->|logcost actor=lane| ACT
  C1 -->|route + dream tasks| TASKS
  C1 & C2 & C3 & C4 -->|empty lane → pick venture| REG

  WD[watchdog.sh cron] -->|any lane stale > N h| NTFY[ntfy push]
  HUMAN[owner] --> UI[kanban UI] --> TASKS
  HUMAN -->|approvals| GATE[approvals.md + PENDING cards]
```

One lane cycle (all roles share this skeleton; the role skill fills in the middle):

1. Gate: interval elapsed AND daily burn under cap AND no PAUSE flag → else sleep.
2. Sweep: read the **whole** lane queue (all tagged cards, all statuses) + unread context rows (cursor `last_swept_at`, stamped now at read time) — reconcile, never replay memory.
3. Claim: atomically claim the top card; if the lane queue is empty, pick a venture (staleness-biased) and run the role's standing playbook for it.
4. Execute small: one card or one playbook step, gated actions → PENDING.
5. Record: card status + context rows + ledger digest + memory learnings; cost row (`actor=<lane>`); heartbeat stamp.

---

## Implementation Units

### U1. Board schema: role tags + atomic claim

**Goal:** Cards can be tagged for a role and claimed atomically by exactly one cycle.

**Requirements:** R2, R4

**Dependencies:** None

**Files:**
- Create: `tools/sql/2026-07-15-role-lanes.sql`
- Modify: `kanban/schema.sql` (keep the canonical schema current), `tools/tasks.sh`
- Test: verification via `tools/db.sh query` runs (no test framework in repo — see Test scenarios)

**Approach:**
- Add `tags text[] not null default '{}'` to `public.tasks`; a `claim_task(p_role text)` RPC selects the highest-priority `todo` card whose tags contain the role `FOR UPDATE SKIP LOCKED`, flips it to `doing`, returns the row.
- Extend the `status` check constraint with `review` — the post-completion verification state between `doing` and `done` (R15); acting lanes finish into `review` and append the `qa` tag, only a verifier verdict moves a card to `done`.
- The QA input path is explicit: `claim_task('qa')` claims `review`-status qa-tagged cards (other roles claim `todo`-status cards) — without this, QA's queue would be structurally empty since completed cards are never `todo`. QA flips `review → done` (the countable "QA-verified" event) or `review → todo` back to the acting lane.
- `tools/tasks.sh`: `add` accepts tags, new `claim <role>` and `list --tag <role>` subcommands; human-assigned cards are never claimable.
- Apply DDL via `tools/db.sh file`; the SQL file is committed (unlike the ad-hoc `agent_jobs` provisioning). All statements are idempotent (`if not exists` / `create or replace`, matching `kanban/schema.sql`) so the file stays safely re-runnable after U10's later edits to it.
- Lock down the RPC: revoke EXECUTE on `claim_task` from PUBLIC/anon/authenticated, grant only to `service_role` — otherwise the anon key shipped in `kanban/config.js` could invoke it from any browser.

**Patterns to follow:** `claim_agent_job(p_worker, p_identities)` claim shape; `tools/tasks.sh` curl/jq conventions; loud exit-2 when keys unset.

**Test scenarios:**
- Happy path: add card tagged `cto` → `claim cto` returns it and status becomes `doing`.
- Edge case: two concurrent `claim cto` calls (backgrounded) against one tagged card → exactly one gets the row, the other gets empty.
- Edge case: `claim qa` with no `qa`-tagged todo cards → empty result, exit 0 (not an error).
- Error path: claim attempt on a card with `assignee='human'` tag mix → never returned by the RPC.
- Integration: kanban UI still renders untagged legacy cards; tagged card shows its tags (U8).

**Verification:** All four scenarios pass against the live Supabase project; existing `tasks.sh list/add/update` behavior unchanged.

---

### U2. Shared context store (`autocomp.context`) + `tools/context.sh`

**Goal:** Lanes coordinate through tagged, insert-only DB records instead of one ledger file.

**Requirements:** R3, R11

**Dependencies:** None (parallel with U1)

**Files:**
- Create: `tools/context.sh`, `tools/context.md`
- Modify: `tools/sql/2026-07-15-role-lanes.sql` (same migration file: `autocomp.context`, `autocomp.lanes`)
- Test: `tools/db.sh query` verification runs

**Approach:**
- `autocomp.context`: id, created_at, lane (actor), company_slug, kind (decision/result/blocker/handoff/learning), tags text[], body, refs (jsonb: card ids, urls). Append-only is enforced against the actual write path: the service-role key bypasses RLS and holds broad default privileges, so the migration explicitly REVOKEs UPDATE/DELETE from `service_role` and adds a `BEFORE UPDATE OR DELETE` trigger that raises — grants alone would not mirror the ledger hard rule.
- `autocomp.lanes`: lane pk, last_cycle_at, last_status, last_swept_at, host, lease_until, note — heartbeat + sweep-cursor + host-lease surface for U5/U6/U7. Enable RLS with an owner-locked SELECT policy (mirroring the existing `autocomp.activity` Ticks-tab policy) so the U8 browser strip works without exposing rows to any anon-key holder; `autocomp.context` gets no browser policy (service-path only) unless the UI later needs it.
- `tools/context.sh post|read|sweep` with `Content-Profile: autocomp` headers. `sweep <lane>` watermarks on `last_swept_at`, stamped at read time to the max `created_at` actually returned — NOT on the end-of-cycle heartbeat, which would permanently skip rows other lanes insert while a cycle is mid-flight (consume-the-whole-queue). `last_cycle_at` stays a pure liveness signal.
- `tools/context.md` documents the split: context = coordination, activity = cost/metrics, ledger.md = audit digest.

**Patterns to follow:** `tools/registry.sh` schema-profile headers and CLI shape; append-only ledger doctrine from CLAUDE.md.

**Test scenarios:**
- Happy path: `context.sh post` then `context.sh read --tag gtm` returns the row.
- Error path: UPDATE/DELETE on `autocomp.context` with the SERVICE-ROLE key is rejected (revoke + trigger, not just grants).
- Edge case: `sweep cto` with no new rows since its cursor → empty, exit 0.
- Integration: a row inserted by another lane while a `cto` cycle is mid-flight IS returned by the next `sweep cto` (cursor stamped at read time, not cycle end).
- Error path: `autocomp.lanes` queried with the bare anon key and no owner session → zero rows (RLS).
- Error path: missing `SUPABASE_SERVICE_KEY` → loud exit 2, no fake write.

**Verification:** Append-only proven by an actual rejected UPDATE; a posted row is visible to a different "lane" reader.

---

### U3. Lane charters (`roles/ceo.md` rewrite; `roles/cto.md`, `roles/qa.md`, `roles/gtm.md`)

**Goal:** Each lane has a charter defining inputs, priority cascade, gates, and output contract — the system prompt substrate for its skill.

**Requirements:** R4, R5, R6, R7, R8, R11

**Dependencies:** U1, U2 (charters reference the claim/context tools)

**Files:**
- Modify: `roles/ceo.md`
- Create: `roles/cto.md`, `roles/qa.md`, `roles/gtm.md`
- Test: none (prompt documents — exercised end-to-end in U4)

**Approach:**
- Keep the existing role-file shape (`# Role` → `## Inputs` → `## How you work` → `## Output`).
- Every charter carries: the whole-queue sweep rule, the no-false-idle cascade (tagged cards → venture playbook → escalate to CEO via context post, in that order), local gate enforcement, the "2 stalls = route around" retry rule, the shared-file append rule (ledger/approvals writes only via `tools/append.sh`), and the end-of-cycle disposition invariant: a cycle never exits leaving its claim in `doing` — incomplete work is flipped back to `todo` with progress notes or decomposed into new tagged cards, so `doing` outside a live cycle unambiguously means crashed (which is exactly what U10's reaper assumes).
- CEO: orchestrate (read whole board + context, verdict per card, tag-route to lanes), dream new tasks bounded by Rule 17 + Hundred-Dollar Test, own approvals bookkeeping (absorbs cfo), read the scoreboard every cycle.
- CTO: single repo writer; build tagged cards; watch logs (lane logs, worker queues, deploy health) and convert anomalies into cards; feature ideas (e.g. directory badges on venture pages) become `ceo`-tagged proposal cards, not silent builds.
- QA: sweep the `review` queue; for each card, match tags to a verifier persona (U11) and dispatch it fresh-context at that persona's model tier; verify from independent evidence only (screenshots/live URLs/server state, per `tools/verify-goal.md`); full-UUID reads; error ≠ absence; PASS → `done`, FAIL → back to the acting lane's queue with evidence attached.
- GTM: pre-authorized bot-identity distribution playbooks (directories, SEO/GEO, indexing); gated sends staged as PENDING; absorbs marketer/sales.

**Patterns to follow:** existing `roles/ceo.md` structure; `.claude/skills/ceo/SKILL.md` verdict taxonomy; CLAUDE.md principles 12 (human cards glanceable) and 17.

**Test scenarios:** Test expectation: none — prompt documents with no runtime surface of their own; behavior is exercised in U4's cycle dry-runs.

**Verification:** Each charter answers: what do I sweep, what do I claim, what do I never do (gates), what do I output — checkable by reading; drift against skills prevented by U4 referencing charters rather than duplicating them.

---

### U4. `initiate-<role>` skills (one cycle per invocation)

**Goal:** `/initiate-ceo|cto|qa|gtm` runs exactly one bounded lane cycle — the unit both herdr tabs and headless runners execute.

**Requirements:** R1, R4, R5, R6, R7, R8, R11

**Dependencies:** U1, U2, U3

**Files:**
- Create: `.claude/skills/initiate-ceo/SKILL.md`, `.claude/skills/initiate-cto/SKILL.md`, `.claude/skills/initiate-qa/SKILL.md`, `.claude/skills/initiate-gtm/SKILL.md`
- Test: seeded end-to-end dry-runs (see Test scenarios)

**Approach:**
- Follow the repo skill conventions: frontmatter with trigger-rich description, numbered operational sections, restated hard rules, Anti-patterns section, cost note.
- Each skill implements the shared cycle skeleton (sweep → claim → execute small → record → report) with the role's charter inlined by reference (`roles/<role>.md`), not duplicated.
- Scope discipline ("execute small"): one claimed card or one playbook step per cycle; anything bigger gets decomposed into new tagged cards (plan big lives in the CEO cycle).
- Headless deltas mirrored from `tools/tick-prompt.md`: no `AskUserQuestion`; gates → approvals.md + card + ntfy; final message = cycle report.
- Venture-pick fallback: when the lane queue is empty, call `registry.sh next` (extended in U5 with a staleness-biased random option) and run the role's standing playbook for that venture.

**Patterns to follow:** `.claude/skills/ceo/SKILL.md` (board verdicts, consume-first), `.claude/skills/autocomp-tick/SKILL.md` (tick structure, verifier subagents, done-check close-out).

**Test scenarios:**
- Happy path (per role): seed one `<role>`-tagged test card with a trivial verifiable goal → run one cycle interactively → card claimed, executed, status updated, context row + cost visible.
- Edge case: empty lane queue → cycle picks a venture and produces playbook output (or an honest "nothing viable, here's why" report) — never a silent no-op.
- Error path: gated action encountered (e.g. a spend) → PENDING approval row + card + ntfy, no execution.
- Integration: QA cycle re-verifies a card the CTO cycle marked done from independent evidence and blocks it when evidence is missing.

**Verification:** One real cycle per role runs end-to-end against seeded cards with the expected side effects observed in Supabase (Principle 13 — real run, not mock).

---

### U5. Lane runner (`tools/role-loop.sh`) + cycle prompts + cost accounting

**Goal:** One script keeps a lane alive 24/7: gate → spawn bounded cycle → harvest measured cost → heartbeat → repeat.

**Requirements:** R1, R9, R10, R12

**Dependencies:** U4

**Files:**
- Create: `tools/role-loop.sh`, `tools/role-prompts/{ceo,cto,qa,gtm}.md`, `tools/append.sh` (flock-wrapped `>>` helper)
- Modify: `tools/registry.sh` (staleness-biased random `next --weighted`; `logcost` accepts lane actors), `.env.example` (`LANE_INTERVAL_CEO/CTO/QA/GTM`, `DAILY_BURN_CAP_USD`)
- Test: short-interval live runs (see Test scenarios)

**Approach:**
- Generalize `tools/tick.sh`: per-lane flock (`private/state/.lane-<role>.lock`), per-lane interval gate, `timeout`-bounded `claude -p "$(cat tools/role-prompts/<role>.md)" --output-format json`, harvest `total_cost_usd`/tokens → `registry.sh logcost` with `actor=<role>` → heartbeat upsert into `autocomp.lanes`, ntfy on cycle failure, exponential backoff after consecutive failures (2 identical failures = stop retrying that card, post a blocker context row).
- Cost rows keep venture attribution (Rule 17's scoreboard aggregates strictly by slug): each cycle writes the venture it worked to `private/state/.current-cycle-slug-<lane>` (mirroring the tick's `.current-tick-slug` handshake; a fixed `company` overhead slug for whole-board CEO orchestration cycles), and the runner harvests it into `logcost <slug> … <actor>`.
- Cross-host single-instance guard: the local flock cannot see the other host, so the runner also takes a DB lease (`autocomp.lanes.host` + `lease_until`, renewed per cycle) and exits loudly (ntfy) if another host holds an unexpired lease — bringing lanes up locally in herdr requires pausing the VPS units first (documented in U6).
- Budget gate before each cycle: sum today's `autocomp.activity` cost across lanes; if ≥ `DAILY_BURN_CAP_USD`, sleep and post one (deduplicated) context row. The gate FAILS CLOSED: if the sum query errors, skip the cycle and ntfy once — a Supabase blip must never silently disable the only automatic spend brake.
- All writes to shared single files (`ledger.md` digests, `approvals.md` PENDING rows, `private/memory/`) go through `tools/append.sh` — a flock on the target file then append — never editor-style read-modify-write; four concurrent cycles racing on `approvals.md` would otherwise risk losing a PENDING gate entry (approval-gate integrity, R11).
- A `PAUSE` sentinel file (or `autocomp.lanes.last_status='paused'`) lets the human or CEO stop any lane — paperclip's "pause any agent at any time".
- Cycle prompts are thin: "run one cycle of the `initiate-<role>` skill; headless deltas apply."

**Patterns to follow:** `tools/tick.sh` (flock, timeout, cost harvest, ntfy), `tools/loop-gate.sh` (pure time gate — never gate on unmeasured numbers).

**Test scenarios:**
- Happy path: `LANE_INTERVAL_QA=0.01 tools/role-loop.sh qa` runs two consecutive cycles; two cost rows with `actor=qa` and two heartbeat stamps appear.
- Edge case: second `role-loop.sh qa` started concurrently → flock makes it exit/wait, no overlapping cycles.
- Error path: cycle exits non-zero → ntfy fired, backoff applied, runner stays alive.
- Error path: daily burn cap simulated as exceeded (low cap) → cycle skipped, single dedup'd context row, no Claude spawn.
- Error path: burn-sum query made to fail (bad key) → cycle skipped + one ntfy (fails closed), runner alive.
- Edge case: second host holds a fresh lease for the lane → runner exits loudly instead of double-running.
- Happy path: cost row lands under the venture slug the cycle worked (and `company` for a whole-board CEO cycle), `actor=<lane>`.
- Integration: `tools/scoreboard.sh` burn column includes lane-actor rows (with `daily-metrics-are-deltas` aggregation check).

**Verification:** A lane left running for several hours produces the expected cadence of cost rows and heartbeats and survives a killed cycle.

---

### U6. Supervision surface: herdr setup + VPS fallback

**Goal:** The four lanes run visibly in herdr tabs on the owner's machine, and headlessly under tmux/systemd on the VPS — same runner either way.

**Requirements:** R1, R12

**Dependencies:** U5

**Files:**
- Create: `tools/herder.md` (playbook: herdr install, four-pane layout each running `tools/role-loop.sh <role>`, optional `~/.config/herdr/agent-detection/claude.toml` manifest notes, tmux fallback commands, systemd unit sketch for the VPS)
- Test: manual bring-up (see Test scenarios)

**Approach:**
- herdr is observability only: panes host the runners; killing a pane kills the lane (watchdog catches it). Document the SSH-survival behavior and the state-detection caveat (manifest tuning deferred).
- VPS story: systemd units (or a tmux session started at boot) per lane, so 24/7 does not depend on the owner's laptop.

**Patterns to follow:** existing `tools/*.md` playbook voice (policy + exact commands + honest-failure notes); `kanban/SETUP.md` for host-setup docs.

**Test scenarios:** Test expectation: none — documentation/ops unit; verified by the manual bring-up below.

**Verification:** Four lanes running in herdr locally (screenshot) and under the fallback on the VPS; both survive an SSH disconnect.

---

### U7. Watchdog + observability updates

**Goal:** Silent lane death is impossible: staleness alerts per lane, lane status visible on the kanban UI and scoreboard.

**Requirements:** R9, R10

**Dependencies:** U2 (heartbeat table), U5

**Files:**
- Modify: `tools/watchdog.sh` (check `autocomp.lanes.last_cycle_at` per lane against per-lane max-age; ntfy names the stale lane; keep the existing tick check until U9 cutover), `tools/scoreboard.sh` (burn per lane actor)
- Test: simulated staleness (see Test scenarios)

**Approach:**
- Zero-token principle preserved: watchdog is curl + date math only.
- Rate-limit alerts per lane (existing `.watchdog-last-alert` pattern, keyed per lane).

**Patterns to follow:** `tools/watchdog.sh` current structure; per-lane idle-pattern awareness from `private/memory/worker-lane-health-probe.md` (a paused lane is not a dead lane — check the PAUSE state before alerting).

**Test scenarios:**
- Happy path: fresh heartbeats → no alert.
- Error path: backdate one lane's `last_cycle_at` beyond max-age → ntfy fired naming that lane; other lanes unaffected.
- Edge case: lane paused via PAUSE sentinel and stale → no alert (paused ≠ dead).
- Edge case: repeated staleness → alert rate-limited, not spammed.

**Verification:** Simulated stale + paused scenarios behave as above against live ntfy.

---

### U8. Kanban UI: tags + lane status

**Goal:** The owner can see role tags on cards and lane liveness at a glance; card conventions stay human-glanceable.

**Requirements:** R2, R10 (visibility half)

**Dependencies:** U1, U2

**Files:**
- Modify: `kanban/app.js`, `kanban/style.css`, `kanban/index.html`
- Test: browser check (see Test scenarios)

**Approach:**
- Render `tags` as small chips on cards. Tag filter: multi-select toggle chips above the board, OR semantics, filtering across all status columns, with a clear-all control and a "no cards match" empty state.
- A one-click "needs your approval" toggle next to the tag filter (reusing `app.js`'s existing needs-you computation, independent of the role-tag filter) — with four lanes raising PENDING cards concurrently, the owner must never have to scan columns for scattered approval flags (principle 12).
- Slim lane-status strip (per lane: last cycle time + status from `autocomp.lanes`) — read-only via the owner-authenticated session (RLS from U2). Staleness uses U7's per-lane max-age as the single threshold (UI and watchdog must agree on what "stale" means); stale renders with the existing `.flag`-style marker; a paused lane (`last_status='paused'`) renders distinctly from stale so the owner never misreads deliberate pause as death; relative timestamps re-render on the existing realtime channel's ticks.
- Render the new `review` status as its own column (or a badge within Doing) so the owner sees work awaiting verification; verdict FAILs surface on the card via the linked context row.
- No redesign; principle 12 card rules unchanged.

**Patterns to follow:** existing `kanban/app.js` notes-parsing and Ticks-tab rendering; vendored supabase-js client usage.

**Test scenarios:**
- Happy path: tagged card shows chips; untagged legacy cards render unchanged.
- Happy path: lane strip shows all four lanes with recent heartbeats; a stale lane renders visibly different.
- Edge case: `autocomp.lanes` empty (pre-migration) → strip hidden, no JS errors.
- Integration: RLS still holds — anon/browser path reads only what it could before plus the new read surfaces intentionally exposed.

**Verification:** Checked in a real browser against the live board (Playwright screenshot acceptable as evidence).

---

### U9. Cutover: parallel run, then retire the hourly tick

**Goal:** Lanes replace the tick as the production loop without a gap in liveness, cost accounting, or auditability; rollback stays one cron edit away.

**Requirements:** R1, R9, R11

**Dependencies:** U5, U6, U7, U10

**Files:**
- Modify: `CLAUDE.md` (run-mode section), `tools/loop.md`, `README.md`, `tools/tick-prompt.md` (deprecation note), crontab on the VPS (operational, not a repo file)
- Test: parallel-run observation (see Test scenarios)

**Approach:**
- Stage 1 (parallel): lanes run on the VPS alongside the existing 5-hourly tick for ~3 days. The tick does NOT go through `claim_task` today (`tasks.sh` is plain read-then-PATCH), so the claim RPC alone cannot prevent tick-vs-lane double-work — the card space is partitioned instead: a Stage-1 delta in `tools/tick-prompt.md` makes the tick treat all role-tagged cards as off-limits and dispatch no repo-writing subagents while a CTO-lane heartbeat is fresh (single-writer holds). Before lanes start, record the tick-era baseline in the ledger: `todo → done` transitions/day from `public.tasks` history over the trailing 30 days (the Success Metrics comparison needs a measured number — never gate on unmeasurable ones).
- Stage 2 (cutover): remove the tick cron entry; watchdog switches fully to lane heartbeats; `tools/tick.sh` retained as documented `FORCE=1` manual fallback.
- Ledger doctrine update in CLAUDE.md: context store = coordination, ledger.md = per-cycle audit digest (append-only unchanged); update the "VPS run mode" paragraph to describe lanes.
- Rollback: re-add the tick cron line; lanes stop via PAUSE — both documented in `tools/loop.md`.

**Patterns to follow:** the previous gate migration write-up in `tools/loop.md` (document why, keep the superseded mechanism's lessons).

**Test scenarios:**
- Integration: during parallel run, one card is never executed by both the tick and a lane (spot-check `autocomp.context` + card history for double-claims).
- Happy path: post-cutover, scoreboard burn continuity — no gap in `autocomp.activity` rows, per-lane actors present.
- Error path: kill all lanes post-cutover → watchdog alerts within the max-age window.

**Verification:** Three days of parallel-run evidence reviewed, then one week post-cutover with no watchdog gaps and the scoreboard fully attributing burn per lane.

---

### U10. Reliability hardening + scale check

**Goal:** The lane system survives crashes, reboots, and concurrency at 2× today's load without silent loss — and adding a lane is proven to be config-only.

**Requirements:** R13, R14

**Dependencies:** U5, U7

**Files:**
- Modify: `tools/role-loop.sh` (stuck-`doing` reaper, boot-safe startup), `tools/sql/2026-07-15-role-lanes.sql` (indexes on `tasks.tags`/`status`, `context.created_at`/`tags`; `claimed_by`/`claimed_at` columns on `tasks` for reaping), `tools/herder.md` (systemd `Restart=always` + boot enablement so a VPS reboot restores all lanes)
- Test: fault-injection runs (see Test scenarios)

**Approach:**
- Reaper: at cycle start, any `doing` card claimed by this lane whose claim is older than the cycle timeout is reset to `todo` with a context row explaining the reset — a crashed cycle can never strand work invisibly.
- Claims are attributed (`claimed_by` = lane, `claimed_at`) so reaping and the U9 double-work spot-check are queries, not archaeology.
- Idempotency rule in every charter: before acting on a claimed card, verify current external state first (the crashed-predecessor may have half-finished) — extends the existing verify-before-done doctrine to verify-before-redo.
- Scale check as an acceptance run, not new machinery: all four lanes at short intervals for a bounded window with ≥2 active ventures in the registry, plus a fifth throwaway lane (`initiate-<role>` copy + runner invocation only) to prove R14's config-only claim.

**Patterns to follow:** `FOR UPDATE SKIP LOCKED` claim semantics (reaper must not race a live claim); `worker-lane-health-probe.md` (known idle patterns ≠ dead).

**Test scenarios:**
- Error path: kill a cycle mid-card (SIGKILL) → next cycle reaps the stuck `doing` card back to `todo` with a context row; no card is lost or double-completed.
- Error path: reboot the host → all lanes come back via systemd/tmux-at-boot without manual steps; heartbeats resume.
- Edge case: reaper encounters a `doing` card claimed by a *live* lane (fresh heartbeat) → leaves it alone.
- Integration (scale): 4 lanes + 2 ventures + short intervals for the bounded window → zero double-claims (query on `claimed_by` history), no missed heartbeats, burn correctly attributed per lane.
- Happy path (R14): a fifth lane runs one cycle end-to-end having only added a charter, a prompt file, and a runner invocation.

**Verification:** All fault-injection scenarios pass with recorded evidence; the R14 config-only claim is demonstrated, then the throwaway lane is removed.

---

### U11. Verifier persona registry (model-tiered task double-checking)

**Goal:** Every completed card is double-checked by a matched, cheapest-capable verifier subagent before it counts as done — copy by a Haiku copy-checker, shipped features by a Sonnet browser-QA/monkey-tester.

**Requirements:** R7, R15, R14 (config-only extension)

**Dependencies:** U1 (`review` status), U3 (QA charter)

**Files:**
- Create: `roles/verifiers/copy-check.md`, `roles/verifiers/site-qa.md`, `roles/verifiers/monkey-test.md`, `roles/verifiers/link-check.md`, `tools/verifiers.md` (registry playbook: tag→persona matching table, model tiers, verdict contract)
- Modify: `tools/verify-goal.md` (generalize the fresh-context verifier pattern to persona dispatch)
- Test: seeded verification runs (see Test scenarios)

**Approach:**
- Each persona file declares: what it checks, its model tier (`haiku` | `sonnet` | session default), required evidence (screenshot, HTTP body, quoted text), and a strict PASS/FAIL + reasons output contract. Dispatch is fresh-context (verifier sees goal + criterion + how to check — never the actor's claims), via the Agent tool's model override in-session or `claude -p --model` from a lane cycle.
- Matching is data: a table in `tools/verifiers.md` maps card tags/kinds to personas (`copy` → copy-check, `feature`/`deploy` → site-qa + monkey-test, `gtm-listing` → link-check). Unmatched cards get the generic `verify-goal` check — nothing skips review.
- Verdicts are recorded as context rows (kind `result`, tags `[qa, verdict]`) with evidence refs; FAIL re-tags the card to the acting lane with the verdict linked. Two consecutive FAILs on the same card escalate to the CEO lane (the 2-stalls rule).
- Monkey-test persona: unscripted interaction fuzz on the changed surface (click/scroll/submit random-ish paths via the existing Playwright layer `browser/browser.mjs`), reporting console errors, broken states, dead links.
- Copy-check persona encodes the repo's taste rules (CLAUDE.md Principle 9, vibecoded-design-tells) as a concrete checklist.

**Patterns to follow:** `tools/verify-goal.md` (fresh-context verifier, PASS/FAIL contract); `roles/*.md` prompt shape; ce-plugin persona-registry style (one small focused reviewer per concern).

**Test scenarios:**
- Happy path: a `copy`-tagged card in `review` with compliant text → copy-check PASS → card `done`, verdict context row with quoted evidence.
- Error path: seeded slop copy (em-dash soup, generic claims) → copy-check FAIL → card back to acting lane's queue with reasons; no `done`.
- Happy path: a `feature` card pointing at a live page → site-qa loads the page via Playwright, screenshot captured, assertions pass → `done`.
- Edge case: card with no matching tags → generic verify-goal check runs (never skipped).
- Error path: verifier itself crashes/times out → card stays in `review`, blocker context row posted — a dead verifier never silently passes work.
- Integration: two consecutive FAILs on one card → CEO-tagged escalation card created.

**Verification:** One real PASS and one real FAIL observed end-to-end per persona against seeded cards, with verdict rows and model tiers confirmed in `autocomp.activity`/`autocomp.context`.

---

## Success Metrics

- **Liveness:** no unalerted gap — a dead or stale lane produces an ntfy alert within its max-age window; zero silent multi-hour stalls (the failure mode that killed the original loop) over the first post-cutover month.
- **Integrity:** zero double-executed cards and zero lost cards (stuck `doing` without reaping) across parallel-run and the first post-cutover month.
- **Cost discipline:** scoreboard shows per-lane burn daily; total burn stays under `DAILY_BURN_CAP_USD`; Rule 17 verdicts remain computable at all times.
- **Scale contract:** adding a lane or venture demonstrably requires zero changes to runner/RPC/watchdog/scoreboard code (U10's fifth-lane check).
- **Throughput (the point of the migration):** `todo → done` transitions/day exceed the measured tick-era baseline (trailing-30-day number recorded in the ledger before Stage 1 — U9) within two weeks of cutover; QA-verified completions are counted as a new series alongside it (they have no tick-era equivalent).
- **Verification coverage:** 100% of cards reaching `done` post-cutover carry a verifier verdict with evidence (no path from `doing` to `done` that skips `review`), and verifier cost stays a small fraction of total burn (cheap tiers doing cheap checks).
- **Business outcomes (the metric that can fail the migration):** within one month post-cutover, per-week GTM outcomes read from `tools/scoreboard.sh` — live listings, verified signups, revenue events — meet or exceed the tick-era rate while total burn stays within a stated multiple of tick-era burn; a miss triggers the documented rollback. The machine metrics above can all pass while the company still produces $0; this one exists so that failure mode is caught, not narrated.

---

## System-Wide Impact

- **Interaction graph:** `tools/tasks.sh` consumers (ceo skill, tick skill, done-check flows) see a new `tags` column — additive, defaults keep old calls working. `registry.sh logcost` gains lane actors — scoreboard and kanban Ticks tab must label them.
- **Error propagation:** a failed cycle must fail loudly (ntfy + non-zero) but never kill the lane runner; a failed Supabase write in a cycle is a reported blocker, never a faked success (hard rule).
- **State lifecycle risks:** double-claim (mitigated by the RPC), stale `doing` cards from crashed cycles (each lane reaps its own stale claims at cycle start — U10; there is no separate CEO reaper), context-store growth (unbounded inserts — acceptable at current scale, revisit later).
- **API surface parity:** kanban UI and `tasks.sh` must both understand tags; approvals flow unchanged across both tick and lanes during parallel run.
- **Integration coverage:** the QA-verifies-CTO scenario (U4) is the one no unit-level check proves — it crosses two lanes and the evidence rule.
- **Unchanged invariants:** the four hard gates; append-only ledger; secrets by name; homelab worker queues (`solve_jobs`, `agent_jobs`) and their claim RPCs; human card conventions (≤5-min, glanceable, "Your move:").

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Token burn ×4+ vs. today's ~5 ticks/day | High | High | Per-lane intervals (conservative defaults), daily burn cap gate before every cycle, measured cost per cycle feeding the scoreboard, CEO reads scoreboard every cycle (Rule 17), PAUSE per lane |
| Lanes die silently (the original loop failure, ×4) | Medium | High | Runner restarts cycles; per-lane DB heartbeats; watchdog alerts naming the lane; herdr/tmux keep processes visible |
| Git conflicts between lanes | Medium | Medium | Single-writer rule: only CTO edits the repo; others propose via cards |
| Double-work on cards (tick + lane during parallel run, or lane + lane) | Medium | Medium | Lane vs lane: atomic `claim_task` RPC (`FOR UPDATE SKIP LOCKED`). Tick vs lane: card-space partition — the tick skips role-tagged cards (it never calls the RPC); U9 spot-checks verify |
| Gate erosion — four autonomous lanes hitting spend/outbound more often | Low | High | Gates enforced per lane charter AND restated per skill; approvals flow unchanged; QA lane cross-checks; gates never propagate between lanes |
| Scoreboard/cost accounting breaks (Rule 17 goes blind) | Medium | High | Cost harvested per cycle from result JSON exactly as today; U5 acceptance requires cost rows; `daily-metrics-are-deltas` aggregation check in U5 tests |
| Human card overload from four dreaming lanes | Medium | Medium | Only CEO creates human cards; principle 12 rules restated in every charter; ideas go to backlog/ideate cards, not human cards |
| Context-store reads diverge from reality (false absence claims between lanes) | Medium | Medium | `verify-subagent-board-writes` rules baked into charters: error ≠ absence, reproduce twice before accusing |

---

## Phased Delivery

### Phase 0 — Cheap premise check (config only, ~3 days)
Before building anything: drop the existing `loop-gate.sh` interval from ~5h to ~1h for a few days and record `todo → done` transitions/day and burn/day. This tests the plan's core premise (cadence is the binding constraint, not human gates or external clocks like directory moderation) for pennies, and produces the tick-era baseline the Success Metrics compare against. If done/day barely moves at 5× cadence, the constraint is elsewhere — re-scope before spending Phases A–D.

### Phase A — Substrate (U1, U2)
Schema, claim RPC, context store, CLIs. Everything is additive; the tick keeps running untouched.

### Phase B — Roles (U3, U4, U11)
Charters + `initiate-<role>` skills, each proven with one real interactive cycle against seeded cards; the verifier registry lands here so "done means verified" holds from the very first lane cycle.

### Phase C — Always-on, GTM lane first (U5, U6, U7, U8)
Lane runner with cost + heartbeats, herdr/tmux supervision, watchdog + UI visibility. Bring-up order is distribution-first (Rule 17 applied to this build): the **GTM lane runs solo for ~1 week** — delivering the claimed distribution win at a quarter of the lane build and de-risking the machinery on one lane — before CEO/CTO/QA lanes switch on. The tick still provides the safety net throughout.

### Phase D — Harden, then cut over (U10, U9)
Reliability hardening and the scale check pass first (crash/reboot/concurrency evidence in hand), then the parallel run and tick retirement; docs updated; rollback documented.

---

## Documentation / Operational Notes

- `CLAUDE.md` "VPS run mode" section, `tools/loop.md`, and `README.md` are updated at U9 — not before, so docs always describe the *running* mode.
- New playbooks: `tools/context.md`, `tools/herder.md`; `tools/role-prompts/*` are operational prompts, not docs.
- Operational cutover steps (crontab edits, systemd units) happen on the VPS and are recorded in the ledger + a context row, per hard rules.
- The board gets one human card at Phase D: "Lanes going live — nothing for you right now; here's the pause switch" (principle 12: agent cards must say nothing is needed).

---

## Sources & References

- Related code: `tools/tick.sh`, `tools/loop-gate.sh`, `tools/watchdog.sh`, `tools/tasks.sh`, `tools/registry.sh`, `tools/agent-task.sh`, `kanban/schema.sql`, `.claude/skills/ceo/SKILL.md`, `.claude/skills/autocomp-tick/SKILL.md`, `roles/ceo.md`
- Institutional learnings: `tools/loop.md`, `private/memory/{consume-the-whole-queue,loop-scope-not-stuck,flow-written-status-verify,verify-subagent-board-writes,worker2-reputation-gate,daily-metrics-are-deltas,oauth-hang-route-around-via-github}.md`
- External: [paperclipai/paperclip](https://github.com/paperclipai/paperclip) · [paperclip.ing](https://paperclip.ing/) · [CMA_plan_big_execute_small.ipynb](https://github.com/anthropics/claude-cookbooks/blob/main/managed_agents/CMA_plan_big_execute_small.ipynb) · [ogulcancelik/herdr](https://github.com/ogulcancelik/herdr) · [herdr.dev/docs/agents](https://herdr.dev/docs/agents/)
