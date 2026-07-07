#!/usr/bin/env bash
# init.sh — one-command bootstrap for a fresh autocomp clone. Idempotent and SAFE: it never
# clobbers an existing private/ or .env. Goal: clone → first tick in about five minutes.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "autocomp — init"
echo

# 1. secrets file (referenced by name from .env; never committed)
if [ -f .env ]; then
  echo "  ✓ .env exists — leaving it alone"
elif [ -f .env.example ]; then
  cp .env.example .env
  echo "  + created .env from .env.example  → fill in your keys"
else
  echo "  ! no .env.example found — create a .env with your keys (see CLAUDE.md 'Secrets vault')"
fi

# 2. this venture's private state (charter, state, memory, site) — the gitignored instance
if [ -d private ]; then
  echo "  ✓ private/ already exists — this clone is initialized, nothing copied"
elif [ -d private.example ]; then
  cp -r private.example private
  echo "  + created private/ from private.example  → edit private/charter.md to your venture"
else
  echo "  ! private.example/ missing — cannot scaffold private/ (re-clone the repo)"
fi

# 3. light prereq checks (non-fatal — just guidance)
command -v claude >/dev/null 2>&1 && echo "  ✓ claude CLI found" || echo "  ! claude CLI not found — install Claude Code (this is the runtime)"
command -v node   >/dev/null 2>&1 && echo "  ✓ node found"       || echo "  ! node not found — needed for browser/ and deploy tooling"

cat <<'NEXT'

Next steps (about 5 minutes):
  1. Fill .env with your keys. Required: your Anthropic access via Claude Code.
     Optional (for deploy/data/email): CLOUDFLARE_API_TOKEN, SUPABASE_URL/KEY, NTFY_TOPIC — see .env.example.
  2. Edit private/charter.md — your venture: mission, product, ICP, budget, success condition.
  3. Read CLAUDE.md — the constitution. It governs every tick.
  4. Run your first tick:
        claude          # then:  /autocomp start
     or headless:  tools/tick.sh

That's it. The company runs as a tick loop from there — it plans, ships, gates anything risky,
and records everything to an append-only ledger.
NEXT
