#!/usr/bin/env bash
# loop-gate.sh — decide whether to launch an autocomp tick on this hourly cron wake.
#
# Policy (owner, 2026-07-04): 24/7 — launch ONE tick roughly every LOOP_INTERVAL_HOURS (~5h),
# REGARDLESS of whether a Claude usage window is active. The headless `claude -p` tick creates
# its own usage, so time-based gating never stalls when idle. (The old window-based gate needed
# an active ccusage block and so SKIP'd forever overnight — observed ~a day-long stall 07-03→04.)
#
# Usage:
#   tools/loop-gate.sh          -> prints LAST_TICK_AGE_MIN, DECISION=TICK|SKIP, REASON
#   tools/loop-gate.sh record   -> stamp NOW as the last tick (call after a successful tick)
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

MARK="private/state/.loop-last-tick"
INTERVAL_H="${LOOP_INTERVAL_HOURS:-5}"
# fire when within ~30min of the interval so an hourly cron reliably catches the ~5h mark
THRESHOLD_MIN=$(( INTERVAL_H * 60 - 30 ))

if [ "${1:-}" = "record" ]; then
  date -u +%FT%TZ > "$MARK"
  echo "recorded tick at $(cat "$MARK")"
  exit 0
fi

now=$(date +%s)
if [ -f "$MARK" ]; then last=$(stat -c %Y "$MARK"); else last=0; fi
age_min=$(( (now - last) / 60 ))
echo "LAST_TICK_AGE_MIN=$age_min  THRESHOLD_MIN=$THRESHOLD_MIN  (interval ${INTERVAL_H}h, 24/7)"
if [ "$age_min" -ge "$THRESHOLD_MIN" ]; then
  echo "DECISION=TICK"
  echo "REASON=${age_min}m since last tick (>= ${THRESHOLD_MIN}m) — 24/7 cadence"
else
  echo "DECISION=SKIP"
  echo "REASON=${age_min}m since last tick (< ${THRESHOLD_MIN}m)"
fi
