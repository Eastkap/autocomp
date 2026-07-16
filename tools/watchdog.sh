#!/usr/bin/env bash
# watchdog.sh — guard for the cron heartbeat (the watcher's watcher).
# The 24/7 gate should fire a tick every ~5h (tools/loop-gate.sh). If none has been recorded
# for too long, the cron itself is down or tick.sh is failing/rate-limited repeatedly. This
# runs from the USER CRONTAB (no Claude, no tokens) and pushes ntfy so the human can look.
#
# U7 addition: per-lane heartbeat check against autocomp.lanes (ceo/cto/qa/gtm). The tick
# check stays primary and network-free; the lane check is best-effort — a Supabase/curl
# failure logs to stderr and skips (never a false alert, never a non-zero exit).
#
# Install (once):  crontab -e  →  */30 * * * * /home/j/autocomp/tools/watchdog.sh
# Env: NTFY_TOPIC, SUPABASE_URL, SUPABASE_SERVICE_KEY from .env.
# Tunables: WATCHDOG_MAX_HOURS (default 8 — one 5h cadence + retry slack),
#           LANE_STALE_HOURS   (default 8 — MUST match kanban/app.js LANE_STALE_HOURS).
set -euo pipefail
cd "$(dirname "$0")/.."
# Explicit env overrides win over .env (test hook; the production cron passes none).
# Set-but-EMPTY counts as an override too: NTFY_TOPIC= makes the whole run a safe no-op.
_ov_topic="${NTFY_TOPIC-__UNSET__}"; _ov_url="${SUPABASE_URL-__UNSET__}"; _ov_key="${SUPABASE_SERVICE_KEY-__UNSET__}"
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
[ "$_ov_topic" != "__UNSET__" ] && NTFY_TOPIC="$_ov_topic"
[ "$_ov_url" != "__UNSET__" ] && SUPABASE_URL="$_ov_url"
[ "$_ov_key" != "__UNSET__" ] && SUPABASE_SERVICE_KEY="$_ov_key"
MAX_H="${WATCHDOG_MAX_HOURS:-8}"
MARK="private/state/.loop-last-tick"
STAMP="private/state/.watchdog-last-alert"

[ -n "${NTFY_TOPIC:-}" ] || exit 0          # no channel -> nothing useful to do
now=$(date +%s)

# --- 1) tick staleness (unchanged — the tick is the production loop until U9 cutover) ---
# age of the last recorded tick (missing file = never ticked = alert)
if [ -f "$MARK" ]; then
  last=$(stat -c %Y "$MARK")
else
  last=0
fi
age_h=$(( (now - last) / 3600 ))
if [ "$age_h" -ge "$MAX_H" ]; then
  # don't re-alert more than once per MAX_H window
  suppressed=0
  if [ -f "$STAMP" ]; then
    since_alert=$(( (now - $(stat -c %Y "$STAMP")) / 3600 ))
    [ "$since_alert" -lt "$MAX_H" ] && suppressed=1
  fi
  if [ "$suppressed" -eq 0 ]; then
    curl -fsS -m 10 \
      -H "Title: autocomp watchdog: heartbeat stalled" \
      -H "Priority: high" \
      -d "No tick recorded for ${age_h}h (threshold ${MAX_H}h). The 24/7 gate should fire every ~5h — check the cron (crontab -l), tools/tick-cron.log, and private/state/tick-runs/ for a failing or rate-limited tick." \
      "https://ntfy.sh/$NTFY_TOPIC" >/dev/null && touch "$STAMP" \
      || echo "watchdog: tick alert push FAILED (curl) — not stamping." >&2
  fi
fi

# --- 2) per-lane heartbeat staleness (U7; best-effort, needs network) --------------------
# A lane counts only once it has ever cycled (last_cycle_at not null) — never-started lanes
# are not alerts pre-cutover. Paused ≠ dead (worker-lane-health-probe rule): skip when
# last_status='paused' or a pause sentinel exists on this host.
LANE_MAX_H="${LANE_STALE_HOURS:-8}"   # must match kanban/app.js LANE_STALE_HOURS
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
  echo "watchdog: SUPABASE_URL/SUPABASE_SERVICE_KEY unset — lane checks skipped." >&2
  exit 0
fi
lanes_json="$(curl -fsS -m 10 \
  "${SUPABASE_URL}/rest/v1/lanes?select=lane,last_cycle_at,last_status&last_cycle_at=not.is.null" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" -H "authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "accept-profile: autocomp" 2>/dev/null)" || lanes_json=""
if [ -z "$lanes_json" ]; then
  echo "watchdog: lanes fetch failed — skipping lane checks this run (no false alerts)." >&2
  exit 0
fi
while IFS=$'\t' read -r lane cyc status; do
  [ -n "$lane" ] || continue
  [ "$status" = "paused" ] && continue                     # deliberate pause, not death
  [ -f "private/state/.lane-${lane}-pause" ] && continue   # sentinel on this host
  cyc_s="$(date -d "$cyc" +%s 2>/dev/null)" || continue    # unparseable -> skip, no false alert
  lane_age_h=$(( (now - cyc_s) / 3600 ))
  [ "$lane_age_h" -lt "$LANE_MAX_H" ] && continue
  # rate-limit per lane (same stamp pattern as the tick alert)
  lstamp="private/state/.watchdog-lane-${lane}-last-alert"
  if [ -f "$lstamp" ]; then
    since=$(( (now - $(stat -c %Y "$lstamp")) / 3600 ))
    [ "$since" -lt "$LANE_MAX_H" ] && continue
  fi
  echo "watchdog: lane ${lane} stale — last cycle ${lane_age_h}h ago (threshold ${LANE_MAX_H}h) — alerting"
  curl -fsS -m 10 \
    -H "Title: autocomp watchdog: lane ${lane} stale" \
    -H "Priority: high" \
    -d "autocomp watchdog: lane ${lane} stale — last cycle ${lane_age_h}h ago (threshold ${LANE_MAX_H}h, last_status '${status:-?}'). Check tools/role-loop.sh, private/state/lane-runs/, and the lane's pause sentinel." \
    "https://ntfy.sh/${NTFY_TOPIC}" >/dev/null && touch "$lstamp" \
    || echo "watchdog: lane ${lane} alert push FAILED (curl) — not stamping." >&2
done < <(printf '%s' "$lanes_json" \
  | jq -r '.[] | [.lane, .last_cycle_at, (.last_status // "")] | @tsv' 2>/dev/null || true)
exit 0
