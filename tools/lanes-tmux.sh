#!/usr/bin/env bash
# lanes-tmux.sh <start|stop|status> — VPS lane supervisor: all role lanes in ONE tmux
# session ("lanes"), one window per role, each window running tools/role-loop.sh <role>.
# Roles are DATA (plan R14): one window per tools/role-prompts/<role>.md.
#
#   start [--force]  Create the session if absent. GUARDED: refuses unless LANES_ENABLED=1
#                    (.env or environment) or --force is passed — cutover to lanes (plan U9)
#                    hasn't happened, so a stray start must never free-run the lanes.
#                    Idempotent: if the session exists, prints it and exits 0.
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

SESSION="lanes"
REPO="$PWD"
ROLES="$(ls tools/role-prompts/ 2>/dev/null | sed -n 's/\.md$//p')"
if [ -z "$ROLES" ]; then
  echo "lanes-tmux.sh: no roles in tools/role-prompts/ — nothing to supervise." >&2
  exit 2
fi

case "${1:-status}" in

  start)
    if [ "${LANES_ENABLED:-0}" != "1" ] && [ "${2:-}" != "--force" ]; then
      echo "lanes-tmux.sh: REFUSING to start — LANES_ENABLED != 1 and no --force." >&2
      echo "  Cutover to role lanes (plan U9) has not happened. Set LANES_ENABLED=1 in .env" >&2
      echo "  when lanes are cleared to run, or pass --force for a supervised test." >&2
      exit 3
    fi
    if tmux has-session -t "$SESSION" 2>/dev/null; then
      echo "session '$SESSION' already running:"
      tmux list-windows -t "$SESSION"
      exit 0
    fi
    first=1
    for r in $ROLES; do
      # `exec` so the pane's group leader IS role-loop.sh (clean TERM targeting in stop).
      if [ "$first" = 1 ]; then
        tmux new-session -d -s "$SESSION" -n "$r" -c "$REPO" "exec $REPO/tools/role-loop.sh $r"
        # Keep dead panes visible: a lane that exits (e.g. FATAL foreign-lease refusal)
        # leaves its last output on screen instead of silently closing the window.
        tmux set-option -t "$SESSION" remain-on-exit on
        first=0
      else
        tmux new-window -t "$SESSION" -n "$r" -c "$REPO" "exec $REPO/tools/role-loop.sh $r"
      fi
    done
    echo "started tmux session '$SESSION' (one window per role):"
    tmux list-windows -t "$SESSION"
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
    echo "usage: lanes-tmux.sh <start [--force] | stop | status>" >&2
    exit 2
    ;;
esac
