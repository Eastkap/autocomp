#!/usr/bin/env bash
# loop-gate.sh — decide whether to launch an autocomp tick on this hourly wake.
#
# Policy (set by the owner): launch ONE tick only when BOTH hold —
#   (a) the active 5-hour usage window is about to reset — < 1h left (spend tail capacity),
#   (b) we have not already ticked in this window (one task per window).
#
# The window's endTime comes straight from ccusage (Anthropic's real reset clock), so this
# is reliable. TOKENS is printed for information only — it does NOT gate the decision.
# (Anthropic doesn't expose the real per-window token ceiling, so any % against a guessed
# budget was noise; we dropped it. See tools/loop.md.)
#
# Usage:
#   tools/loop-gate.sh           -> prints WINDOW_*, MINS_LEFT, TOKENS, DECISION=TICK|SKIP, REASON
#   tools/loop-gate.sh record    -> mark the current window as ticked (call after a tick)
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
LAST_TICK_FILE="private/state/.loop-last-tick"

JSON="$(npx -y ccusage@latest blocks --active --json 2>/dev/null || echo '{}')"
WINDOW_START="$(printf '%s' "$JSON" | python3 -c 'import sys,json;
try: print(json.load(sys.stdin)["blocks"][0]["startTime"])
except Exception: pass' 2>/dev/null || true)"

if [ "${1:-}" = "record" ]; then
  [ -n "$WINDOW_START" ] && printf '%s\n' "$WINDOW_START" > "$LAST_TICK_FILE" \
    && echo "recorded tick for window $WINDOW_START" \
    || echo "no active window to record"
  exit 0
fi

LAST_FILE="$LAST_TICK_FILE" python3 - "$JSON" <<'PY'
import sys, json, os, datetime
raw = sys.argv[1]
last_file = os.environ["LAST_FILE"]
try:
    b = json.loads(raw)["blocks"][0]
except Exception:
    print("DECISION=SKIP")
    print("REASON=no active usage block (session idle) — re-check next hour")
    sys.exit(0)
now = datetime.datetime.now(datetime.timezone.utc)
end = datetime.datetime.fromisoformat(b["endTime"].replace("Z", "+00:00"))
start = b["startTime"]
mins_left = (end - now).total_seconds() / 60
tokens = b.get("totalTokens", 0)
in_last_hour = mins_left <= 60
try:
    done = open(last_file).read().strip() == start
except Exception:
    done = False
print(f"WINDOW_START={start}")
print(f"WINDOW_END={b['endTime']}")
print(f"MINS_LEFT={mins_left:.0f}")
print(f"TOKENS={tokens}  # informational only — does not gate")
print(f"IN_LAST_HOUR={in_last_hour} ALREADY_TICKED={done}")
if in_last_hour and not done:
    print("DECISION=TICK")
    print("REASON=window resets in <1h + not yet ticked this window")
else:
    rs = []
    if not in_last_hour: rs.append(f"{mins_left:.0f}m left in window (resets >1h away)")
    if done: rs.append("already ticked this window")
    print("DECISION=SKIP")
    print("REASON=" + "; ".join(rs))
PY
