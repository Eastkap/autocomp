#!/usr/bin/env bash
# role-loop.sh <role> — the 24/7 lane runner (generalizes tools/tick.sh to role lanes).
# Keeps ONE role lane alive: gate → spawn one bounded `claude -p` cycle → harvest the
# measured cost into the registry → heartbeat → sleep → repeat. One runner per lane,
# per host: a local flock stops a second local instance, a DB lease (autocomp.lanes
# host/lease_until) stops a second host. Roles are DATA (plan R14): any <role> with a
# tools/role-prompts/<role>.md prompt file is runnable — no role list in code.
#
# Usage:
#   tools/role-loop.sh qa                      # run the qa lane forever
#   LANE_INTERVAL_QA=0.01 tools/role-loop.sh qa   # short-interval test run
#
# Env (.env / environment):
#   LANE_INTERVAL_<ROLE>    hours between cycles (default 24 — cautious until U9 cutover)
#   DAILY_BURN_CAP_USD      today's total autocomp.activity cost at/over this → skip (60)
#   LANE_CYCLE_TIMEOUT_MIN  hard timeout per spawned cycle (30)
#
# Gates, in order, every iteration:
#   (a) local flock  (b) pause sentinel private/state/.lane-<role>-pause  (c) DB lease
#   (d) interval gate on lanes.last_cycle_at  (e) daily burn cap — FAILS CLOSED: if the
#   burn query errors we skip the cycle (a Supabase blip must never disable the only
#   automatic spend brake). Then (f) the stuck-claim reaper (U10) resets THIS lane's
#   claims left behind by crashed cycles, before the new cycle claims anything.
# Boot safety: a user-crontab `@reboot tools/lanes-tmux.sh start` line brings runners
# back after a VPS reboot; pre-cutover the LANES_ENABLED guard in lanes-tmux.sh makes
# that a loud no-op (verified U6/U10) — see tools/herder.md.
# Safety: the approval gate lives INSIDE the cycle (CLAUDE.md hard rules) — this script
# only handles timing, spawn, cost accounting, and single-instance guarantees.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
# Source .env but let the REAL environment win (unlike tick.sh): command-line overrides
# (`LANE_INTERVAL_QA=0.01 tools/role-loop.sh qa`) are the supported test/tuning surface.
env_snapshot="$(export -p)"
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
eval "$env_snapshot"

ROLE="${1:-}"
PROMPT="tools/role-prompts/${ROLE}.md"
if [ -z "$ROLE" ] || [ ! -f "$PROMPT" ]; then
  echo "role-loop.sh: ERROR — unknown role '${ROLE:-<none>}'." >&2
  echo "usage: role-loop.sh <role>   (role = any file in tools/role-prompts/)" >&2
  echo "available: $(ls tools/role-prompts/ 2>/dev/null | sed 's/\.md$//' | tr '\n' ' ')" >&2
  exit 2
fi

# --- exit trace ----------------------------------------------------------------------
# A lane runner that dies leaves nothing behind: its tmux window used to close outright,
# taking the scrollback with it (gtm, 28 + 30 Jul — the second outage ran ~11h before a
# tick noticed). remain-on-exit now keeps the pane, but a pane is not durable. Append one
# line per exit to a file so the NEXT investigator has a timestamp and an exit code even
# if the session is gone. SIGKILL still leaves nothing — that is what the heartbeat is for.
mkdir -p private/state/lane-runs
_exitlog="private/state/lane-runs/${ROLE}-exits.log"
# lanes-tmux.sh passes LANES_SESSION explicitly; a non-default (test) session writes to its
# own file so a self-test can never plant fake crash lines in the production forensic log.
[ "${LANES_SESSION:-lanes}" != "lanes" ] && _exitlog="${_exitlog}.${LANES_SESSION}"
on_exit() {
  local rc=$?
  printf '%s [%s] runner EXIT rc=%s host=%s pid=%s\n' \
    "$(date -u +%FT%TZ)" "$ROLE" "$rc" "$(hostname)" "$$" >>"$_exitlog" 2>/dev/null || true
}
trap on_exit EXIT

URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "role-loop.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY not set — lanes need the DB (lease, burn gate, heartbeat)." >&2
  exit 2
fi
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Accept-Profile: autocomp" -H "Content-Profile: autocomp")
# public-schema headers (tasks table) — no Accept/Content-Profile (default = public)
thdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json")

ROLE_UC="$(printf '%s' "$ROLE" | tr '[:lower:]' '[:upper:]' | tr -c 'A-Z0-9' '_')"
ivar="LANE_INTERVAL_${ROLE_UC}"
INTERVAL_H="${!ivar:-24}"
INTERVAL_SEC="$(awk -v h="$INTERVAL_H" 'BEGIN{ s=int(h*3600); if (s<1) s=1; print s }')"
LEASE_SEC=$(( INTERVAL_SEC * 2 ))
CAP="${DAILY_BURN_CAP_USD:-60}"
TIMEOUT_MIN="${LANE_CYCLE_TIMEOUT_MIN:-30}"
HOST="$(hostname)"
PAUSE="private/state/.lane-${ROLE}-pause"
STAMP="private/state/.lane-${ROLE}-last-cycle"   # local fallback if a heartbeat write is lost
SLUGF="private/state/.current-cycle-slug-${ROLE}"
mkdir -p private/state/lane-runs

# --- single local instance ---------------------------------------------------------
exec 8>"private/state/.lane-${ROLE}.lock"
if ! flock -n 8; then
  echo "role-loop.sh: FATAL — another local role-loop.sh ${ROLE} already holds private/state/.lane-${ROLE}.lock. Exiting." >&2
  exit 1
fi

release_lease() {
  # Only release a lease WE hold (host=eq.$HOST filter) — never null another host's.
  curl -fsS "${hdr[@]}" -X PATCH \
    "$URL/rest/v1/lanes?lane=eq.${ROLE}&host=eq.${HOST}" \
    -H "Prefer: return=minimal" -d '{"host":null,"lease_until":null}' >/dev/null 2>&1 || true
}
SLEEP_PID=""
on_signal() {
  echo "$(date -u +%FT%TZ) [$ROLE] signal received — releasing lease and exiting clean."
  [ -n "$SLEEP_PID" ] && kill "$SLEEP_PID" 2>/dev/null || true
  release_lease
  exit 0
}
trap on_signal TERM INT

snooze() {  # interruptible sleep so SIGTERM releases the lease promptly.
  # 8>&- : the child must NOT inherit the flock fd — an orphaned sleep would
  # otherwise hold the lane lock (blocking restart) until its timer expired.
  # (The claude cycle child DOES inherit it, deliberately: if the supervisor
  # dies mid-cycle, the lock stays held until the cycle ends — no double-run.)
  sleep "$1" 8>&- & SLEEP_PID=$!
  wait "$SLEEP_PID" || true
  SLEEP_PID=""
}

log() { echo "$(date -u +%FT%TZ) [$ROLE] $*"; }

# --- stuck-claim reaper (U10) --------------------------------------------------------
# At cycle start (before any new claim) reset THIS lane's crashed-cycle claims so a
# SIGKILLed cycle can never strand work invisibly. RACE-SAFETY INVARIANT: we only reap
# claims whose claimed_at is older than LANE_CYCLE_TIMEOUT_MIN + REAP_SLACK_MIN. A live
# parallel cycle of the SAME lane holding a fresh claim is impossible by construction —
# the flock above means one runner per lane per host, the DB lease means one host per
# lane, and this runner spawns cycles strictly sequentially — so any claim older than
# timeout+slack can only belong to a dead cycle. Other lanes' claims are never touched
# (claimed_by=eq.$ROLE). The PATCH repeats the claimed_at cutoff filter, so even a
# theoretical claim refresh between the GET and the PATCH is left alone.
#   non-qa: status=doing + claimed_by=$ROLE + old claimed_at → back to todo (tags kept),
#           claim nulled, a reset line appended to notes, one blocker context row per card.
#   qa:     status=review + claimed_by=qa + old claimed_at → claim nulled only (the card
#           STAYS review, re-claimable), one blocker context row per card. A post-FAIL
#           todo card that still carries claimed_by='qa' (the RPC's bounce leaves it) is
#           deliberately ignored here via the status filter — harmless, by design.
# Reap failures are logged and skipped (never block the cycle); direct PostgREST PATCH,
# not the claim RPC, so reaping stays observable as plain row updates.
REAP_SLACK_MIN=10
reap_stuck() {
  local cutoff q stuck n row id title notes reset_line
  cutoff="$(date -u -d "-$(( TIMEOUT_MIN + REAP_SLACK_MIN )) minutes" +%FT%TZ)"
  if [ "$ROLE" = "qa" ]; then
    q="status=eq.review&claimed_by=eq.qa"
  else
    q="status=eq.doing&claimed_by=eq.${ROLE}"
  fi
  if ! stuck="$(curl -fsS "${thdr[@]}" "$URL/rest/v1/tasks?${q}&claimed_at=lt.${cutoff}&select=id,title,notes,claimed_at")"; then
    log "reaper: stuck-claim query FAILED — skipping reap this iteration"; return 0
  fi
  n="$(jq 'length' <<<"$stuck")"
  [ "$n" -eq 0 ] && return 0
  log "reaper: $n stuck ${ROLE} claim(s) older than $(( TIMEOUT_MIN + REAP_SLACK_MIN ))m — resetting"
  while IFS= read -r row; do
    id="$(jq -r '.id' <<<"$row")"; title="$(jq -r '.title' <<<"$row")"
    if [ "$ROLE" = "qa" ]; then
      curl -fsS "${thdr[@]}" -X PATCH \
        "$URL/rest/v1/tasks?id=eq.${id}&claimed_by=eq.qa&claimed_at=lt.${cutoff}" \
        -H "Prefer: return=minimal" -d '{"claimed_by":null,"claimed_at":null}' \
        || { log "reaper: PATCH failed for card $id — leaving as-is"; continue; }
      log "reaper: released stuck qa claim on review card $id ($title)"
      bash tools/context.sh post "$ROLE" blocker \
        "reaper: released stuck qa claim on review card ${id} ('${title}') — claimed_at older than $(( TIMEOUT_MIN + REAP_SLACK_MIN ))m means the claiming cycle died; card stays in review, re-claimable" \
        --tags reaper --refs "$(jq -n --arg c "$id" '{card:$c}')" || true
    else
      notes="$(jq -r '.notes // ""' <<<"$row")"
      reset_line="[$(date -u +%FT%TZ)] reaper: reset doing→todo — ${ROLE} cycle holding the claim died (claim older than $(( TIMEOUT_MIN + REAP_SLACK_MIN ))m); verify external state before redoing."
      [ -n "$notes" ] && notes="${notes}
${reset_line}" || notes="$reset_line"
      curl -fsS "${thdr[@]}" -X PATCH \
        "$URL/rest/v1/tasks?id=eq.${id}&claimed_by=eq.${ROLE}&claimed_at=lt.${cutoff}" \
        -H "Prefer: return=minimal" \
        -d "$(jq -n --arg nts "$notes" '{status:"todo",claimed_by:null,claimed_at:null,notes:$nts}')" \
        || { log "reaper: PATCH failed for card $id — leaving as-is"; continue; }
      log "reaper: reset stuck doing card $id ($title) back to todo"
      bash tools/context.sh post "$ROLE" blocker \
        "reaper: reset card ${id} ('${title}') doing→todo — the ${ROLE} cycle holding it died (claim older than $(( TIMEOUT_MIN + REAP_SLACK_MIN ))m); tags kept, claim cleared; next claimer must verify external state first (verify-before-redo)" \
        --tags reaper --refs "$(jq -n --arg c "$id" '{card:$c}')" || true
    fi
  done < <(jq -c '.[]' <<<"$stuck")
}

log "lane runner up on ${HOST} — interval ${INTERVAL_H}h (${INTERVAL_SEC}s), burn cap \$${CAP}/day, cycle timeout ${TIMEOUT_MIN}m"

FAIL_MULT=1          # backoff multiplier: 1 → 2× → 4× → 8× interval on repeat failures
DB_FAIL_NOTIFIED=0   # single ntfy per outage streak (lease/burn query failures)

while :; do
  # (b) pause sentinel — human/CEO brake; cheap no-op iterations while present
  if [ -f "$PAUSE" ]; then
    log "paused ($PAUSE present) — sleeping ${INTERVAL_SEC}s"
    snooze "$INTERVAL_SEC"; continue
  fi

  # (c) DB lease — cross-host single-instance guard. Fail closed on query error.
  if ! row="$(curl -fsS "${hdr[@]}" "$URL/rest/v1/lanes?lane=eq.${ROLE}&select=host,lease_until,last_cycle_at")"; then
    log "lane-row query FAILED — cannot verify lease; skipping cycle (fail closed)"
    if [ "$DB_FAIL_NOTIFIED" = 0 ]; then
      bash tools/notify.sh "autocomp: $ROLE lane DB unreachable" "lanes query failed on $HOST — cycles skipped (fail closed) until it recovers" || true
      DB_FAIL_NOTIFIED=1
    fi
    snooze "$INTERVAL_SEC"; continue
  fi
  other_host="$(jq -r '.[0].host // empty' <<<"$row")"
  lease_until="$(jq -r '.[0].lease_until // empty' <<<"$row")"
  now="$(date +%s)"
  if [ -n "$other_host" ] && [ "$other_host" != "$HOST" ] && [ -n "$lease_until" ]; then
    lease_epoch="$(date -d "$lease_until" +%s 2>/dev/null || echo 0)"
    if [ "$lease_epoch" -gt "$now" ]; then
      log "FATAL — lane '$ROLE' is leased to host '$other_host' until $lease_until. Refusing to double-run. Pause that runner first."
      bash tools/notify.sh "autocomp: $ROLE lane lease conflict" "$HOST refused to start: $other_host holds the $ROLE lease until $lease_until" || true
      exit 1
    fi
  fi
  # take/renew the lease (upsert also creates the row for a brand-new lane — R14)
  lease_iso="$(date -u -d "+${LEASE_SEC} seconds" +%FT%TZ)"
  curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/lanes?on_conflict=lane" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    -d "$(jq -n --arg l "$ROLE" --arg h "$HOST" --arg u "$lease_iso" '{lane:$l,host:$h,lease_until:$u}')" \
    || { log "lease renew FAILED — skipping cycle"; snooze "$INTERVAL_SEC"; continue; }

  # (d) interval gate — freshest of DB last_cycle_at and the local stamp
  last_epoch=0
  db_last="$(jq -r '.[0].last_cycle_at // empty' <<<"$row")"
  [ -n "$db_last" ] && last_epoch="$(date -d "$db_last" +%s 2>/dev/null || echo 0)"
  if [ -f "$STAMP" ]; then
    local_epoch="$(stat -c %Y "$STAMP")"
    [ "$local_epoch" -gt "$last_epoch" ] && last_epoch="$local_epoch"
  fi
  age=$(( now - last_epoch ))
  if [ "$age" -lt "$INTERVAL_SEC" ]; then
    remaining=$(( INTERVAL_SEC - age ))
    log "last cycle ${age}s ago (< ${INTERVAL_SEC}s) — sleeping ${remaining}s"
    snooze "$remaining"; continue
  fi

  # (e) daily burn cap — FAILS CLOSED on query error (never spawn unmetered)
  today="$(date -u +%F)"
  if ! burn_rows="$(curl -fsS "${hdr[@]}" "$URL/rest/v1/activity?select=cost_usd&at=gte.${today}T00:00:00Z&cost_usd=not.is.null")"; then
    log "burn-sum query FAILED — skipping cycle (fail closed)"
    if [ "$DB_FAIL_NOTIFIED" = 0 ]; then
      bash tools/notify.sh "autocomp: $ROLE lane burn gate blind" "activity cost query failed on $HOST — cycle skipped (fails closed)" || true
      DB_FAIL_NOTIFIED=1
    fi
    snooze "$INTERVAL_SEC"; continue
  fi
  DB_FAIL_NOTIFIED=0
  burn="$(jq '[.[].cost_usd // 0] | add // 0' <<<"$burn_rows")"
  if awk -v b="$burn" -v c="$CAP" 'BEGIN{ exit !(b>=c) }'; then
    capstamp="private/state/.burncap-context-${today}"
    if [ ! -e "$capstamp" ]; then
      rm -f private/state/.burncap-context-* 2>/dev/null || true
      bash tools/context.sh post "$ROLE" blocker \
        "daily burn cap hit: \$${burn} spent today >= cap \$${CAP} — lanes skipping cycles until UTC midnight" \
        --tags ceo,burncap || true
      touch "$capstamp"
    fi
    log "burn cap: \$${burn} today >= \$${CAP} — skipping cycle"
    snooze "$INTERVAL_SEC"; continue
  fi

  # (f) reap this lane's stuck claims from crashed cycles (U10) — before the new
  # cycle claims anything, so reset cards are immediately re-claimable.
  reap_stuck

  # (g) spawn ONE bounded cycle, fresh context
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  OUT="private/state/lane-runs/${ROLE}-${TS}.json"
  ERR="private/state/lane-runs/${ROLE}-${TS}.err"
  rm -f "$SLUGF"
  touch "$STAMP"
  log "spawning cycle → $OUT (burn today \$${burn})"
  if timeout "${TIMEOUT_MIN}m" claude -p "$(cat "$PROMPT")" --output-format json >"$OUT" 2>"$ERR"; then
    # (h) harvest measured cost + venture attribution
    COST="$(jq -r '.total_cost_usd // 0' "$OUT")"
    TOKENS="$(jq -r '[.usage.input_tokens, .usage.output_tokens, .usage.cache_read_input_tokens, .usage.cache_creation_input_tokens] | map(. // 0) | add' "$OUT" 2>/dev/null || echo 0)"
    SLUG="$(head -1 "$SLUGF" 2>/dev/null | tr -d '[:space:]')"; SLUG="${SLUG:-company}"
    bash tools/append.sh private/state/lane-costs.log "$TS lane=$ROLE slug=$SLUG cost_usd=$COST tokens=$TOKENS" || true
    # A dropped cost row blinds the daily burn gate — never fail this silently (U10).
    bash tools/registry.sh logcost "$SLUG" "$TOKENS" "$COST" "$ROLE" \
      || log "WARNING: logcost FAILED (slug=$SLUG cost_usd=$COST) — this cycle's spend is MISSING from the burn gate; backfill via tools/registry.sh logcost"
    # (i) heartbeat
    bash tools/context.sh heartbeat "$ROLE" ok || true
    FAIL_MULT=1
    log "cycle done [$SLUG] cost_usd=$COST tokens=$TOKENS"
    echo "--- $ROLE cycle report ---"
    jq -r '.result // "(no result field)"' "$OUT" | head -40
  else
    # (j) failure: ntfy + heartbeat(failed) + exponential backoff (2×→4×→8× interval)
    log "cycle FAILED — see $ERR"
    tail -5 "$ERR" 2>/dev/null || true
    bash tools/notify.sh "autocomp: $ROLE lane cycle FAILED" "run ${ROLE}-${TS} on $HOST — see private/state/lane-runs/" || true
    bash tools/context.sh heartbeat "$ROLE" failed || true
    FAIL_MULT=$(( FAIL_MULT * 2 )); [ "$FAIL_MULT" -gt 8 ] && FAIL_MULT=8
    backoff=$(( INTERVAL_SEC * FAIL_MULT ))
    log "backoff: sleeping ${backoff}s (${FAIL_MULT}× interval)"
    snooze "$backoff"; continue
  fi
done
