#!/usr/bin/env bash
# agent-task.sh — the loop's side of the agentic-browser worker (worker 2).
# Enqueues an interactive web TASK (natural language) for a homelab agent-worker to
# perform in a real logged-in browser, then reports the result. For multi-step
# "log in and do X / sign up / fill this form" work the TRAWL solve tier can't do.
#
# Usage:
#   tools/agent-task.sh do "<task>" [start_url] [identity] [timeout_s]   # enqueue + wait
#   tools/agent-task.sh add "<task>" [start_url] [identity]              # enqueue only, print id
#   tools/agent-task.sh status <id>                                     # full job JSON
#   tools/agent-task.sh workers                                         # recent agent activity
#
#   identity: boseclaw (default, bot) | personal  — a personal job is only ever picked up
#   by a homelab worker explicitly configured with IDENTITIES including 'personal'.
#
# Honest failure: if no worker completes it in time, exits non-zero (job left queued/running);
# never fabricates a result (CLAUDE.md).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
[ -n "$URL" ] && [ -n "$KEY" ] || { echo "agent-task.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY not set." >&2; exit 2; }
API="$URL/rest/v1"
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json")

add() {  # task start_url identity -> id
  local body
  body=$(jq -n --arg t "$1" --arg u "${2:-}" --arg i "${3:-boseclaw}" \
    '{task:$t, identity:$i} + (if $u=="" then {} else {start_url:$u} end)')
  curl -fsS "${hdr[@]}" -X POST "$API/agent_jobs" -H "Prefer: return=representation" -d "$body" | jq -r '.[0].id'
}

wait_for() {  # id timeout_s
  local id="$1" timeout="${2:-600}" waited=0 row st
  while [ "$waited" -lt "$timeout" ]; do
    row=$(curl -fsS "${hdr[@]}" "$API/agent_jobs?id=eq.$id&select=status,result,error")
    st=$(echo "$row" | jq -r '.[0].status')
    case "$st" in
      done)          echo "$row" | jq -r '.[0].result'; return 0 ;;
      failed)        echo "agent-task.sh: job $id FAILED — $(echo "$row"|jq -r '.[0].error')" >&2; return 1 ;;
      needs_approval) echo "agent-task.sh: job $id needs approval before it can proceed." >&2; return 3 ;;
    esac
    sleep 5; waited=$((waited+5))
  done
  echo "agent-task.sh: job $id not finished in ${timeout}s (status '$st'; is a homelab agent-worker running? 'tools/agent-task.sh workers'). Left in queue." >&2
  return 1
}

case "${1:-}" in
  do)      id=$(add "$2" "${3:-}" "${4:-boseclaw}"); echo "enqueued $id — waiting…" >&2; wait_for "$id" "${5:-600}" ;;
  add)     add "$2" "${3:-}" "${4:-boseclaw}" ;;
  status)  curl -fsS "${hdr[@]}" "$API/agent_jobs?id=eq.$2&select=*" | jq '.[0]' ;;
  workers) curl -fsS "${hdr[@]}" "$API/agent_jobs?order=claimed_at.desc.nullslast&limit=10&select=id,status,identity,worker_id,task,claimed_at,completed_at" | jq -c '.[]' ;;
  *) echo "usage: agent-task.sh do|add|status|workers  (see header)"; exit 2 ;;
esac
