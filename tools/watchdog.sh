#!/usr/bin/env bash
# watchdog.sh — guard for the cron heartbeat (the watcher's watcher).
# The 24/7 gate should fire a tick every ~5h (tools/loop-gate.sh). If none has been recorded
# for too long, the cron itself is down or tick.sh is failing/rate-limited repeatedly. This
# runs from the USER CRONTAB (no Claude, no tokens) and pushes ntfy so the human can look.
#
# Install (once):  crontab -e  →  */30 * * * * /home/j/autocomp/tools/watchdog.sh
# Env: NTFY_TOPIC from .env. Tunable: WATCHDOG_MAX_HOURS (default 8 — one 5h cadence + retry slack).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
MAX_H="${WATCHDOG_MAX_HOURS:-8}"
MARK="private/state/.loop-last-tick"
STAMP="private/state/.watchdog-last-alert"

[ -n "${NTFY_TOPIC:-}" ] || exit 0          # no channel -> nothing useful to do
now=$(date +%s)

# age of the last recorded tick (missing file = never ticked = alert)
if [ -f "$MARK" ]; then
  last=$(stat -c %Y "$MARK")
else
  last=0
fi
age_h=$(( (now - last) / 3600 ))
[ "$age_h" -lt "$MAX_H" ] && exit 0

# don't re-alert more than once per MAX_H window
if [ -f "$STAMP" ]; then
  since_alert=$(( (now - $(stat -c %Y "$STAMP")) / 3600 ))
  [ "$since_alert" -lt "$MAX_H" ] && exit 0
fi

curl -fsS -m 10 \
  -H "Title: autocomp watchdog: heartbeat stalled" \
  -H "Priority: high" \
  -d "No tick recorded for ${age_h}h (threshold ${MAX_H}h). The 24/7 gate should fire every ~5h — check the cron (crontab -l), tools/tick-cron.log, and private/state/tick-runs/ for a failing or rate-limited tick." \
  "https://ntfy.sh/$NTFY_TOPIC" >/dev/null && touch "$STAMP"
