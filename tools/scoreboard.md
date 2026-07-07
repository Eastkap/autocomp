# Tool: scoreboard — the burn-vs-income score (Principle 17)

`tools/scoreboard.sh` prints, per venture: tokens + model-$ burned (from `autocomp.activity`
per-tick cost rows), revenue / signups / human-visits (from `autocomp.metrics_daily`), net
position, and a **verdict** (`EARNING` / `SELL` / `PRE-GTM`). It's the day-to-day answer to the
only question that stops the build-forever tar pit: *are we burning tokens for nothing, and is
GTM actually running?*

## When to run
- **Every tick, in the plan step** (SKILL.md §3) and inside `/next-move` (§4.5) — before deciding
  what to do. A `SELL` verdict forbids new construction that tick (CLAUDE.md #17).
- Any time the owner asks "how are we doing / what are we spending vs earning."

## Reading it
- `model$` = measured Anthropic cost of the ticks (real, from the result JSON, not a guess).
- `rev$ / signups / humans` = measured from `metrics_daily` (bot-filtered human beacon).
- `net$` = revenue − model burn. Approved cash spend (domains/ads) is **not yet wired
  per-venture** — it lives in `private/state/pnl.md` ($0 to date); the footer says so. When a
  venture starts spending cash, wire that in rather than letting the scoreboard understate burn.
- **Verdict logic:** `EARNING` = revenue>0 (shows % of cost recovered); `SELL` = burn/traffic but
  $0 revenue → distribution is the job, not building; `PRE-GTM` = no ticks/metrics yet.

## Honesty
Never edit the numbers. If Supabase is unreachable the script exits non-zero — report that, don't
fake a table. The whole point is that the score can't lie (ties to the append-only ledger ethos).

## Known gaps (surface, don't silently ignore — Principle 3)
- Per-venture cash spend not wired (only model burn + revenue are live). Backlog it when a venture
  buys a domain or runs an ad.
- Ticks that run one venture but touch another aren't cost-split — cost lands on the ticked slug.
