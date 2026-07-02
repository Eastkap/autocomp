#!/usr/bin/env bash
# watchdog.sh — cron-run guard for the in-session loop (the watcher's watcher).
# The ScheduleWakeup heartbeat chain can silently lapse (observed 2026-07-01: ~19h gap).
# This runs from the USER CRONTAB (no Claude, no tokens) and pushes ntfy if no tick has
# been recorded for too long, so the human can nudge the session.
#
# Install (once):  crontab -e  →  */30 * * * * /home/j/autocomp/tools/watchdog.sh
# Env: NTFY_TOPIC from .env. Tunable: WATCHDOG_MAX_HOURS (default 7 — one 5h window + slack).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
MAX_H="${WATCHDOG_MAX_HOURS:-7}"
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
  -H "Title: autocomp watchdog: loop may have lapsed" \
  -H "Priority: high" \
  -d "No tick recorded for ${age_h}h (threshold ${MAX_H}h). The ScheduleWakeup chain may have broken — open the session and restart the hourly loop." \
  "https://ntfy.sh/$NTFY_TOPIC" >/dev/null && touch "$STAMP"
