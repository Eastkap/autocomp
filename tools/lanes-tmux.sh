#!/usr/bin/env bash
# lanes-tmux.sh <start|stop|status> — VPS lane supervisor: all role lanes in ONE tmux
# session ("lanes"), one window per role, each window running tools/role-loop.sh <role>.
# Roles are DATA (plan R14): one window per tools/role-prompts/<role>.md.
#
#   start [--force]  Create the session if absent. GUARDED: refuses unless LANES_ENABLED=1
#                    (.env or environment) or --force is passed — cutover to lanes (plan U9)
#                    hasn't happened, so a stray start must never free-run the lanes.
#                    Idempotent: if the session exists, prints it and exits 0.
#   ensure           Self-heal: recreate any role window that is MISSING or whose pane is
#                    DEAD, leaving live ones untouched. Same LANES_ENABLED guard as start;
#                    creates the session outright if absent. Rate-limited per role
#                    (ENSURE_MIN_GAP_MIN, default 60) so a crash-looping lane is respawned
#                    at most once an hour instead of hammered. Prints one line per role and
#                    exits 0 when everything is live, 1 if a respawn was rate-limited or
#                    failed — that exit code is what watchdog.sh reports. Why this exists:
#                    `start` is session-level idempotent, so a single lane window dying left
#                    NOTHING that could bring it back (gtm died 28 Jul and 30 Jul; the second
#                    outage ran ~11h). See card 27e25d22.
#   stop             Graceful: SIGTERM each window's process group (role-loop traps TERM,
#                    releases its DB lease), wait up to 15s, then kill-session.
#   status           tmux session/window state + per-lane pause sentinel + autocomp.lanes
#                    lease/heartbeat summary via curl (degrades to a warning if the DB is
#                    unreachable — status must never fail because Supabase blipped).
#
# Boot persistence: a user-crontab line `@reboot .../lanes-tmux.sh start` brings the session
# up after a reboot; the LANES_ENABLED guard makes that a loud no-op until U9 flips it.
# Playbook (incl. herdr on the owner machine + the one-host lease rule): tools/herder.md.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
export LC_ALL=C.UTF-8   # ssh-forwarded LC_CTYPE=UTF-8 is invalid here and makes bash warn on every spawn
# Source .env but let the real environment win (same convention as role-loop.sh).
env_snapshot="$(export -p)"
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
eval "$env_snapshot"

SESSION="${LANES_SESSION:-lanes}"   # overridable so `ensure` can be tested in an isolated session
REPO="$PWD"
ROLES="$(ls tools/role-prompts/ 2>/dev/null | sed -n 's/\.md$//p')"
if [ -z "$ROLES" ]; then
  echo "lanes-tmux.sh: no roles in tools/role-prompts/ — nothing to supervise." >&2
  exit 2
fi

# remain-on-exit is a WINDOW option: setting it once on the session only ever stuck to the
# first window (verified 30 Jul — ceo had it, cto/qa/gtm did not), which is why the gtm
# window vanished twice with no scrollback to explain it. Set it per window, every time.
# Known race, accepted: a runner that dies in the microseconds between new-window and this
# call still closes its window (seen in the self-test, where flock made runners exit
# instantly). Production crashes happen hours in, and the durable record is now
# lane-runs/<role>-exits.log, not the pane — so `ensure` just recreates it next pass.
keep_dead() { tmux set-window-option -t "${SESSION}:${1}" remain-on-exit on >/dev/null 2>&1 || true; }

guard_enabled() {  # $1 = subcommand name, $2 = optional --force
  if [ "${LANES_ENABLED:-0}" != "1" ] && [ "${2:-}" != "--force" ]; then
    echo "lanes-tmux.sh: REFUSING to ${1} — LANES_ENABLED != 1 and no --force." >&2
    echo "  Cutover to role lanes (plan U9) has not happened. Set LANES_ENABLED=1 in .env" >&2
    echo "  when lanes are cleared to run, or pass --force for a supervised test." >&2
    exit 3
  fi
}

start_session() {  # create the session with one window per role
  local first=1 r
  for r in $ROLES; do
    # `exec` so the pane's group leader IS role-loop.sh (clean TERM targeting in stop).
    if [ "$first" = 1 ]; then
      tmux new-session -d -s "$SESSION" -n "$r" -c "$REPO" "exec $REPO/tools/role-loop.sh $r"
      first=0
    else
      tmux new-window -t "$SESSION" -n "$r" -c "$REPO" "exec $REPO/tools/role-loop.sh $r"
    fi
    keep_dead "$r"
  done
}

case "${1:-status}" in

  start)
    guard_enabled start "${2:-}"
    if tmux has-session -t "$SESSION" 2>/dev/null; then
      echo "session '$SESSION' already running:"
      tmux list-windows -t "$SESSION"
      exit 0
    fi
    start_session
    echo "started tmux session '$SESSION' (one window per role):"
    tmux list-windows -t "$SESSION"
    ;;

  ensure)
    guard_enabled ensure "${2:-}"
    GAP_MIN="${ENSURE_MIN_GAP_MIN:-60}"
    if ! tmux has-session -t "$SESSION" 2>/dev/null; then
      echo "session '$SESSION' absent — starting it."
      start_session
      tmux list-windows -t "$SESSION"
      exit 0
    fi
    # window_name -> pane_dead (1 when remain-on-exit kept a corpse around)
    live="$(tmux list-windows -t "$SESSION" -F '#{window_name} #{pane_dead}' 2>/dev/null || true)"
    rc=0
    for r in $ROLES; do
      state="$(printf '%s\n' "$live" | awk -v r="$r" '$1==r {print $2; found=1} END{ if(!found) print "missing" }')"
      case "$state" in
        0) echo "$r: live"; keep_dead "$r"; continue ;;
        1) reason="pane dead" ;;
        *) reason="window missing" ;;
      esac
      stamp="private/state/.lane-${r}-respawn"
      if [ -f "$stamp" ]; then
        gap=$(( ( $(date +%s) - $(stat -c %Y "$stamp") ) / 60 ))
        if [ "$gap" -lt "$GAP_MIN" ]; then
          echo "$r: $reason — RATE-LIMITED (respawned ${gap}m ago, gap ${GAP_MIN}m); not respawning"
          rc=1; continue
        fi
      fi
      [ "$state" = "1" ] && tmux kill-window -t "${SESSION}:${r}" 2>/dev/null || true
      if tmux new-window -d -t "$SESSION" -n "$r" -c "$REPO" "exec $REPO/tools/role-loop.sh $r" 2>/dev/null; then
        keep_dead "$r"; touch "$stamp"
        echo "$r: $reason — RESPAWNED"
      else
        echo "$r: $reason — respawn FAILED" >&2; rc=1
      fi
    done
    exit "$rc"
    ;;

  stop)
    if ! tmux has-session -t "$SESSION" 2>/dev/null; then
      echo "session '$SESSION' not running — nothing to stop."
      exit 0
    fi
    pids="$(tmux list-panes -s -t "$SESSION" -F '#{pane_pid}')"
    echo "TERMing lane process groups: $(echo "$pids" | tr '\n' ' ')"
    for p in $pids; do
      kill -TERM -- "-$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null || true
    done
    # role-loop's TERM trap releases the DB lease then exits 0; give that time to land.
    for _ in $(seq 1 15); do
      alive=0
      for p in $pids; do kill -0 "$p" 2>/dev/null && alive=1; done
      [ "$alive" = 0 ] && break
      sleep 1
    done
    [ "${alive:-0}" = 1 ] && echo "WARNING: some lane PIDs still alive after 15s — killing session anyway." >&2
    tmux kill-session -t "$SESSION" 2>/dev/null || true
    echo "session '$SESSION' stopped."
    ;;

  status)
    echo "== tmux =="
    if tmux has-session -t "$SESSION" 2>/dev/null; then
      tmux list-windows -t "$SESSION" -F '#{window_name}: pane_pid=#{pane_pid} dead=#{pane_dead}'
    else
      echo "session '$SESSION' not running."
    fi
    echo "== pause sentinels =="
    for r in $ROLES; do
      if [ -f "private/state/.lane-${r}-pause" ]; then echo "$r: PAUSED"; else echo "$r: active"; fi
    done
    echo "== DB leases / heartbeats (autocomp.lanes) =="
    if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
      echo "(SUPABASE_URL / SUPABASE_SERVICE_KEY not set — skipping DB summary)"
    elif rows="$(curl -fsS --max-time 10 \
        -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        -H "Accept-Profile: autocomp" \
        "$SUPABASE_URL/rest/v1/lanes?select=lane,host,lease_until,last_cycle_at,last_status&order=lane")"; then
      jq -r '.[] | "\(.lane): host=\(.host // "-") lease_until=\(.lease_until // "-") last_cycle=\(.last_cycle_at // "-") status=\(.last_status // "-")"' <<<"$rows"
    else
      echo "(lanes query failed — DB unreachable or table missing; leases unknown)"
    fi
    ;;

  *)
    echo "usage: lanes-tmux.sh <start [--force] | ensure [--force] | stop | status>" >&2
    exit 2
    ;;
esac
