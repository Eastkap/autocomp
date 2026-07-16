# Per-task independent verifier (definition of done, per goal)

Before a tick marks any success criterion met, an **independent, context-less subagent** confirms
it against reality — not against the doer's story. The doer can't grade its own homework (it's
biased toward "done"); a fresh agent that never saw the work can only report what it observes.
This is the task-level twin of the turn-level close-out audit (`tools/done-check.md`), and it
strengthens Principle 13 (test every change) with separation of concerns (Principle from
2026-07-03: orchestrator does, an independent agent verifies).

## When
For every action whose backlog/kanban success criterion you're about to check off — and any
"done" claim that isn't a trivial fact you already observed inline this turn. Skip only for
truly mechanical edits already verified in-context (e.g. a one-line copy fix you re-read).

## How
Spawn a fresh `Agent` (general-purpose; Sonnet is enough for most checks). Hand it ONLY:
- the **goal** (one line),
- its **verifiable success criterion** (Principle 4),
- **how to check** it concretely — the URL to curl, the file + grep, the SQL/REST query, the
  command to run.

Do NOT hand it the doer's narrative, logs, or conclusion — that just invites it to agree. It
must go look. Ask it to return: `PASS` or `FAIL`, the **evidence it actually observed**, and (on
FAIL) the gap.

## Matched personas (the specialized form of this check)
This generic check is the **fallback**. When the work has a matching check type,
dispatch the matched verifier persona instead — same fresh-context rules, but with a
concrete checklist, a declared cheapest-capable model tier, and a stricter evidence
contract. The registry is `tools/verifiers.md` (tag→persona table: `copy` → copy-check,
`feature`/`deploy` → site-qa + monkey-test, `gtm-listing` → link-check); persona files
live in `roles/verifiers/`. Unmatched work still gets THIS check — nothing skips
verification either way.

## Acting on the result
- **PASS** → mark the criterion met; cite the verifier's evidence in the ledger.
- **FAIL** → do NOT mark done. Keep the item open/blocked with the verifier's finding, and either
  fix it this tick or record why it's deferred. A FAIL the doer disagrees with is still a FAIL
  until independently resolved.

## Cost note
One extra subagent per verified goal. Cheap relative to shipping a false "done" that compounds.
Batch independent goals into parallel verifiers. For a whole turn's worth, prefer the single
close-out audit (`done-check.md`) over many tiny ones.
