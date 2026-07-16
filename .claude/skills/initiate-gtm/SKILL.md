---
name: initiate-gtm
description: Run exactly ONE bounded cycle of the persistent GTM distribution lane — sweep the gtm queue + context stream + scoreboard, atomically claim one gtm-tagged card or run one pre-authorized bot-identity distribution step (directories, SEO/GEO, indexing), verify every submission live, stage gated sends as PENDING, then record and heartbeat. Use when the user says "initiate GTM", "run a gtm cycle", "/initiate-gtm", or the gtm lane runner fires this as its headless cycle prompt.
---

# initiate-gtm — one GTM lane cycle

One bounded cycle; the lane runner loops it, you don't. `roles/gtm.md` IS the contract —
this skill adds only the mechanics of a cycle. `CLAUDE.md` hard rules bind throughout.
You sell what already exists — distribution-first is the company's anti-tar-pit rule.

## 1. Load
Read `roles/gtm.md` in full and adopt it. Read `CLAUDE.md` hard rules +
`private/charter.md` (ICP, channels) + the playbook matching the claimed work
(`tools/directories.md`, `tools/launchdirectories-list.md`, `tools/gtm-sources.md`,
`tools/outreach.md`, `tools/gsc.md`; skills: `launch-directories`, `fetch-protected`).

## 2. Gate
If `private/state/.lane-gtm-pause` exists: run `tools/context.sh heartbeat gtm paused`,
report "gtm lane paused (sentinel present)" and STOP — a cheap no-op cycle, not an error.

## 3. Sweep (whole queue, never from memory)
- `tools/tasks.sh list-all --tag gtm` — ALL statuses.
- `tools/context.sh sweep gtm` — unread coordination rows.
- `tools/scoreboard.sh` — burn with $0 in = where distribution is owed.

## 4. Claim & execute SMALL
- `tools/tasks.sh claim gtm` — atomic; empty result = empty queue, not an error.
- **Verify-before-redo, always:** check for the live listing/page state FIRST — a crashed
  predecessor may already have submitted; a duplicate submission burns directory reputation.
- **Pre-authorized — do, don't ask:** bot-identity GTM under the boseclaw accounts is the
  standing authorization — directory/launch listings, SEO/GEO/structured data/llms.txt on
  our own pages, indexing (`tools/gsc.py`, IndexNow), reading communities, drafting.
  Re-asking per listing is the timid failure mode.
- **Gated — stage, never execute:** any send from the mail domain, mass/cold outbound,
  spend (paid solves are value-call PENDINGs), anything under the owner's personal
  identity. Worker-2-held actions (community promo posts, account creation) route to CEO
  up front.
- ONE card or ONE playbook step per cycle; a directory batch → decomposed into gtm-tagged
  cards (plan-big-execute-small). Web tiers: plain HTTP → `fetch-protected` → Playwright
  read-only; never classic Chromium for logins.
- **Verify every submission live before recording it:** re-fetch the listing URL or read
  the post-action screenshots; a flow-returned "submitted" is a claim. Unverified stays
  labeled unverified — no invented listings, ever.
- **Queue empty →** `tools/registry.sh next`, then ONE step of that venture's standing
  distribution sweep (unsubmitted directories, index coverage, GEO surface, pending-listing
  checks, outreach drafts staged PENDING). Genuinely nothing viable →
  `tools/context.sh post gtm handoff "<escalation>" --tags ceo` — "everything gated"
  blocks the selling lane, not the company; never falsely idle.
- 2 stalls on the same step = broken-for-us: route around, kill with the reason recorded,
  or escalate — never a third identical attempt.

## 5. Record
- **Finish into `review` + the qa tag — never straight to `done`:** `tools/tasks.sh get
  <id>` → compose the union (the `tag` verb REPLACES) → `tools/tasks.sh tag <id>
  "<current-tags>,qa"` → `update <id> review "<what + live evidence>"`. **Listing/
  directory cards additionally get the `gtm-listing` tag in that same union** — it is
  what routes them to the cheap haiku link-check in `tools/verifiers.md` (without it QA
  falls through to the generic sonnet-tier check and the cost design silently breaks).
- Context rows: `kind=result` per VERIFIED listing with the live URL in refs
  (`--slug <venture> --refs '{"card":"<uuid>","url":"<live>"}'`); `blocker`/`handoff` as
  needed.
- Venture slug worked → `private/state/.current-cycle-slug-gtm` (one line, overwrite;
  `company` for cross-venture work).
- ONE ledger digest line to `private/state/ledger.md` via `tools/append.sh` (pending U5 —
  until it exists, append with `>>` only, never editor-style read-modify-write). PENDING
  gates likewise appended to `private/state/approvals.md`, never rewritten.
- Disposition invariant: never exit with your claim in `doing` — incomplete → `todo` with
  progress notes (which directories done, which remain), or decomposed.
- `tools/context.sh heartbeat gtm <ok|idle|blocked> "<one-liner>"` — last, always.

## 6. Report
Final message = the cycle report: per submission — directory, status, live-verification
evidence (URL fetched / screenshot read), unverified items labeled as such; drafts staged
+ PENDINGs created; cards moved; what was NOT done this cycle (Principle 11).

## Headless deltas (lane runner / `claude -p`)
- No `AskUserQuestion`.
- Gated classes: PENDING appended to `private/state/approvals.md` +
  `tools/context.sh post gtm handoff "<gate summary>" --tags ceo` (CEO owns the human
  approval card — you never create human cards) + `tools/notify.sh` push.
- Never self-schedule — the runner owns cadence.

## Anti-patterns
- **Re-gating pre-authorized bot-identity GTM** — a PENDING for a routine listing is the
  timid failure mode the standing authorization exists to kill.
- **Recording an unverified "submitted"** as live — the listing URL fetch IS the record.
- **Re-submitting without checking for the existing listing** (reputation burn).
- **Executing a send/spend because it feels small** — gates have no de-minimis exception.
- **Marking your own listing `done`** — review + qa tag; QA link-checks it.
- **`tag <id> qa` without the union** — the verb replaces; you just untagged gtm.
- **Draining a whole directory batch in one cycle** instead of decomposing.

## Cost note
Cheap scoped execution, and the lane Rule 17 exists for — its cadence stays ≥ the CTO's.
One claim or one playbook step, live-verify, out. Browser-tier fetches cost seconds, not
dollars; paid solves are the only spend and they are PENDINGs, not defaults.
