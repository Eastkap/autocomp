# tool: company registry — the multi-venture brain

One Supabase database (`autocomp` schema) tracks EVERY company the loop operates:
what exists, its stage/status/priority, when it last got a tick, and a full activity
history. This is how a single loop runs multiple ventures without starving any.

## Tables
- `autocomp.companies` — slug, name, one_liner, stage, status (active|paused|killed),
  **priority** (higher ticks first), url, **last_tick_at**, **last_task**.
- `autocomp.activity` — append-style log: slug, task, detail, actor, at.

## How a tick uses it (wired into the tick skill)
1. **Pick:** `tools/registry.sh next` → the active company with the highest priority,
   ties broken by stalest `last_tick_at` (nulls first, so new companies get attention).
   That company's `private/` state is what the tick loads and works.
2. **Work** the tick as normal (plan → dispatch → gate → record).
3. **Log:** `tools/registry.sh log <slug> "<what was done>" "<result>" [actor]` — appends
   to activity AND touches `last_tick_at`/`last_task`. Log once per completed action or
   once per tick with a summary; sub-agent results use their role as `actor`.
4. `tools/registry.sh history <slug>` answers "what has this company been doing lately"
   without reading its whole ledger.

## Rules
- The ledger (`private/state/ledger.md`) stays the authoritative audit record — the
  registry is the operational index (fast "who's next / what happened lately").
- Owner sets `priority`/`status` (via SQL, or a future admin surface). Loop never kills
  or pauses a company on its own — that's a destructive-class decision → gate.
- Honest entries only: log what actually ran, with verification in `detail`.
