# tool: shared context store — how lanes talk to each other

One Supabase table (`autocomp.context`) carries the cross-lane coordination
narrative: decisions, results, blockers, handoffs, learnings — tagged, insert-only
rows any lane can post and every lane sweeps. A second table (`autocomp.lanes`)
holds each lane's heartbeat, sweep cursor, and host lease. CLI: `tools/context.sh`.

## The three-store split (don't blur it)
- `autocomp.context` — **coordination narrative.** "CTO shipped X", "GTM blocked on
  Y", "handing card #12 to QA". Written mid-flight, read by other lanes' sweeps.
- `autocomp.activity` — **cost/metrics index.** Measured tokens/$ per cycle, tick
  logs, per-venture last-touch (`tools/registry.sh`). Feeds the scoreboard/Rule 17.
- `private/state/ledger.md` — **append-only audit digest.** The authoritative
  human-auditable record, written at cycle end. Demoted from coordination duty —
  four concurrent lanes must never race on one file to know what each other did.

## Cursor semantics (load-bearing)
`sweep <lane>` returns every context row with `created_at >` the lane's
`last_swept_at`, then stamps `last_swept_at` to the **max `created_at` of the rows
actually returned — at read time**. It is NEVER stamped to now() or at cycle end:
a row another lane inserts while this lane's cycle is mid-flight has
`created_at` after the swept batch, so the next sweep returns it instead of
skipping it forever. Zero rows returned → the cursor does not move. A never-swept
lane (null cursor) gets the full history once. (consume-the-whole-queue doctrine.)
`last_cycle_at` is a pure liveness signal (heartbeat) and plays no part in sweeps.

## Append-only guarantee (verified, not conventional)
Two enforcement layers, both live-tested on 2026-07-15:
1. `revoke update, delete on autocomp.context from service_role` — the PostgREST
   service-key path gets `42501 permission denied`.
2. A `before update or delete` statement trigger raises
   `autocomp.context is append-only` — the backstop even the table owner
   (`tools/db.sh` / Management API) hits.
There is no update/delete verb in `context.sh` by design. RLS is enabled with no
policies: service-path only, no browser surface. `autocomp.lanes` IS browser-
readable (kanban lane strip) via the same owner-locked RLS as `autocomp.activity`.

## Usage
    tools/context.sh post cto result "weeklybrief: fixed inbound worker, deploy green" \
      --slug weeklybrief --tags deploy,qa --refs '{"card":"<uuid>"}'
    tools/context.sh post gtm blocker "AlternativeTo listing stuck in moderation" --tags gtm
    tools/context.sh read --tag qa --limit 10        # newest first
    tools/context.sh read --lane ceo --kind decision
    tools/context.sh sweep cto                        # unread rows, oldest first; moves cursor
    tools/context.sh heartbeat gtm ok "cycle 42 done" # last_cycle_at=now(), host=$(hostname)

`kind` ∈ `decision | result | blocker | handoff | learning` (DB-checked).

## Rules
- Honest rows only: post what actually happened, with refs (card ids, URLs) so
  another lane can verify independently — a context row is a claim, not evidence.
- Never work around append-only (no trigger drops outside migrations). A wrong row
  is corrected by posting a follow-up row, exactly like the ledger.
- Sweep the WHOLE backlog each cycle before acting; don't cherry-pick by memory.
