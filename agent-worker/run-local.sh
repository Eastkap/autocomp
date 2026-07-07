#!/usr/bin/env bash
# run-local.sh — run worker 2 NATIVELY (no Docker) against your real local Chrome.
# The simplest "just run a loop on my Chrome" path: a venv + the consumer loop that
# claims agent_jobs and drives your logged-in Chrome profile. Ctrl-C to stop.
#
#   1) put SUPABASE_URL, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY in agent-worker/.env
#      (cp .env.example .env)   — or export them before running
#   2) ./run-local.sh           # first run tells you the one-time login step
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; }

: "${SUPABASE_URL:?set SUPABASE_URL (in .env or env)}"
: "${SUPABASE_SECRET_KEY:?set SUPABASE_SECRET_KEY}"
: "${ANTHROPIC_API_KEY:?set ANTHROPIC_API_KEY}"

PROFILE="${PROFILE_DIR_BOSECLAW:-$HOME/agent-profiles/boseclaw}"
export PROFILE_DIR_BOSECLAW="$PROFILE"
export IDENTITIES="${IDENTITIES:-boseclaw}"

# one-time login gate: an empty/absent profile means Chrome isn't logged in yet
if [ ! -d "$PROFILE" ] || [ -z "$(ls -A "$PROFILE" 2>/dev/null)" ]; then
  mkdir -p "$PROFILE"
  CHROME=$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || echo google-chrome)
  cat <<EOF

  First run — log the boseclaw profile in ONCE (real Chrome, real you; automated
  logins get blocked by Google, CLAUDE.md #14):

     $CHROME --user-data-dir="$PROFILE"

  → sign into the boseclaw Google + GitHub (+ any directory accounts), close the
    window, then re-run ./run-local.sh

EOF
  exit 0
fi

cd worker
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
echo "→ installing deps (first run only)…"
pip -q install -r requirements.txt
python -m playwright install chromium >/dev/null 2>&1 || true

echo "→ worker 2 consumer loop starting — it will claim + run any task I enqueue. Ctrl-C to stop."
exec python -u worker.py
