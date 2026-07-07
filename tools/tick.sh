#!/usr/bin/env bash
# tick.sh — cron entry point for the autocomp heartbeat (headless run mode).
# Each hour: run the timing gate; on TICK spawn ONE fresh `claude -p` tick, then mark the
# window done and log the tick's measured token cost to the registry. On SKIP: exit quietly.
#
#   crontab: 5 * * * * /home/j/autocomp/tools/tick.sh >> <log> 2>&1
#   manual supervised run (bypasses the gate decision, still records): FORCE=1 tools/tick.sh
#
# Safety: the approval gate lives INSIDE the tick (CLAUDE.md hard rules) — this script only
# handles timing, spawn, and honest cost accounting. Never edits past state.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p private/state/tick-runs
exec 9>private/state/.tick.lock
flock -n 9 || { echo "$(date -u +%FT%TZ) tick already running — skip"; exit 0; }

GATE="$(bash tools/loop-gate.sh)"; echo "$GATE"
DECISION="$(sed -n 's/^DECISION=//p' <<<"$GATE")"
if [ "${FORCE:-0}" != "1" ] && [ "$DECISION" != "TICK" ]; then exit 0; fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="private/state/tick-runs/$TS.json"
ERR="private/state/tick-runs/$TS.err"
rm -f private/state/.current-tick-slug
echo "$(date -u +%FT%TZ) spawning headless tick → $OUT"

# One tick, fresh context. 90-min hard timeout as a runaway backstop.
if ! timeout 5400 claude -p "$(cat tools/tick-prompt.md)" --output-format json >"$OUT" 2>"$ERR"; then
  echo "$(date -u +%FT%TZ) tick FAILED (window NOT recorded — cron may retry this window)"
  tail -5 "$ERR" || true
  bash tools/notify.sh "autocomp: headless tick FAILED" "run $TS — see private/state/tick-runs/" || true
  exit 1
fi

bash tools/loop-gate.sh record

COST="$(jq -r '.total_cost_usd // 0' "$OUT")"
TOKENS="$(jq -r '[.usage.input_tokens, .usage.output_tokens, .usage.cache_read_input_tokens, .usage.cache_creation_input_tokens] | map(. // 0) | add' "$OUT" 2>/dev/null || echo 0)"
SLUG="$(head -1 private/state/.current-tick-slug 2>/dev/null | tr -d '[:space:]')"; SLUG="${SLUG:-unknown}"
echo "$TS slug=$SLUG cost_usd=$COST tokens=$TOKENS" >> private/state/tick-costs.log
bash tools/registry.sh logcost "$SLUG" "$TOKENS" "$COST" || true

echo "--- CEO report ---"
jq -r '.result // "(no result field)"' "$OUT"
bash tools/notify.sh "autocomp: tick done [$SLUG]" "$(jq -r '.result // ""' "$OUT" | head -c 180)" || true
