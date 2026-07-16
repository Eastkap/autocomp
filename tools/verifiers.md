# tool: verifier persona registry — matched, cheapest-capable double-checking

Every card that reaches `review` gets double-checked by a **matched verifier persona**
before QA moves it to `done` — copy by a Haiku copy-checker, shipped features by a Sonnet
browser-QA + monkey-tester, listings by a Haiku link-checker. Each persona is a small
system-prompt file in `roles/verifiers/` with a declared model tier, so cheap checks stay
cheap and adding a check type is one new file (the config-only scale contract). The
generic fallback for unmatched cards is `tools/verify-goal.md`. **Nothing skips review.**

## Matching table (card tags → persona)

| Card tag(s)          | Persona(s) — dispatch in order       | Model tier |
|----------------------|--------------------------------------|------------|
| `copy`               | `roles/verifiers/copy-check.md`      | haiku      |
| `feature`, `deploy`  | `roles/verifiers/site-qa.md` THEN `roles/verifiers/monkey-test.md` — **both must PASS** | sonnet |
| `gtm-listing`        | `roles/verifiers/link-check.md`      | haiku      |
| *(no match)*         | generic `tools/verify-goal.md` check | sonnet     |

First matching row wins; a card carrying both `copy` and `feature` runs both rows'
personas (all must PASS). Lane-routing tags (`cto`, `qa`, `gtm`, `ceo`) never match a
persona — they say who acts, not what to check.

## Model tiers + dispatch mechanics

- **haiku** = `claude-haiku-4-5-20251001` — Agent-tool model string `"haiku"`. Used by
  copy-check and link-check: text/HTTP assertions need no expensive reasoning.
- **sonnet** — Agent-tool model string `"sonnet"`. Used by site-qa and monkey-test:
  driving Playwright and judging live-page state needs the mid tier.

**In-session:** spawn a fresh `Agent` with the persona file as the system prompt and the
`model` override set to the persona's tier. The verifier gets ONLY: the **goal** (one
line), the **verifiable success criterion**, and **how to check** (URL / file / command /
expected string) — NEVER the actor's narrative, logs, or conclusion. A verifier that
reads the doer's claims just agrees with them; it must go look (`tools/verify-goal.md`).

**Headless lane cycle:** the QA cycle itself (`initiate-qa`, running under `claude -p`)
dispatches the persona the same way via its own Agent tool with the model override —
no extra process needed.

## Verdict contract (what every persona returns)

`PASS` or `FAIL` + **reasons** + **evidence refs** — file paths, URLs checked with HTTP
status codes, quoted text spans, screenshot paths. "Looks fine" is not a verdict;
evidence the verifier did not itself observe is not evidence.

QA records every verdict as a context row:

    tools/context.sh post qa result "PASS|FAIL: <evidence observed>" \
      --tags qa,verdict[,<persona>] --refs '{"card":"<uuid>","evidence":"<url/path>"}'

- **PASS** (all matched personas) → `tools/tasks.sh update <id> done "<evidence one-liner>"`.
- **FAIL** → verdict row first, then card back to `todo` with the acting lane's tag
  restored (`tools/tasks.sh tag <id> <acting-lane>` then `update <id> todo "QA FAIL: <gap>"`).
- **2 consecutive FAILs on the same card** → ceo-tagged escalation card
  (`tools/tasks.sh add "ESCALATION: <card> failed QA twice" 3 "<both gaps>" agent ceo`);
  stop bouncing it (the 2-stalls rule).
- **Verifier crashed / timed out / couldn't reach the target** → the card **STAYS in
  `review`** + a `blocker` context row naming what the verifier couldn't do. A dead
  verifier never passes work — and never fails it either; inability is not a verdict.

## Cost note

Verifier burn must stay a small fraction of lane burn: haiku personas cost pennies per
check, and one card gets at most its matched persona chain — never a second opinion "to
be sure". If a check needs sonnet-tier judgment, the table says so; don't up-tier ad hoc.
