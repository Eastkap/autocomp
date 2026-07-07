# Close-out audit (definition of done)

Run at the end of any substantial work turn or tick (CLAUDE.md #16). Best done by a **spawned
reviewer subagent** (fresh eyes, e.g. an Opus/Sonnet `general-purpose` Agent) so it isn't the
same context that just did the work and might rationalize gaps.

## What the reviewer is handed
1. A short list of what this turn set out to do and what actually happened (tasks worked,
   decisions made, what was marked done / blocked / handed to the human).
2. The rules: `CLAUDE.md` (principles + hard rules).
3. Live board state: `tools/tasks.sh list` (agent) + the human tasks
   (`assignee=eq.human&status=in.(todo,doing)` via the REST helper).

## What it verifies (return findings, most-important first)
1. **Hard rules honored?** No money/outbound/destructive executed without approval; no secret in
   a tracked file/ledger/prompt; ledger append-only; no invented numbers.
2. **Blocked only on the irreducible?** Every item left undone or marked `blocked` must be
   genuinely un-fixable by the loop (identity-bound credential, spend, send, judgment) — NOT
   something self-fixable that should have been done (#15). Flag any "blocked" that the loop
   could actually have resolved.
3. **Everything offloaded to the board?** Every action the human still owes is a kanban card with
   the right status and a note of what the loop already finished (#12). Every card the loop
   advanced is updated (done/blocked/notes). Anything touched but not on the board = a gap.
4. **Reported honestly?** Claims of "done" were actually verified (#13); skips/caveats stated (#11).

## Acting on the result
Fix what it flags **now** (update cards, un-block self-fixable items and do them, add missing
cards). Only then end the turn. The audit is a gate, not a formality — if it finds a self-fixable
blocker, that's a #15 miss: resolve it, don't just note it.
