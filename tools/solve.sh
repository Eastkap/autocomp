#!/usr/bin/env bash
# solve.sh — the loop's side of the pull-based solver queue.
# Enqueues a bot-walled URL as a `solve_jobs` row; a homelab trawl-worker (residential
# IP) claims it, runs it through local TRAWL, and writes the solved HTML back. This
# lets the loop fetch Cloudflare/Turnstile/hCaptcha-walled pages WITHOUT hosting a
# browser on this datacenter VPS (see trawl-worker/ and tools/trawl.md).
#
# Usage:
#   tools/solve.sh get  <url> [timeout_s]          # enqueue + wait, print solved HTML to stdout
#   tools/solve.sh post <url> <postData> [timeout_s]
#   tools/solve.sh enqueue <url> [get|post] [postData]   # enqueue only, print job id
#   tools/solve.sh status <id>                     # print a job's status/result JSON
#   tools/solve.sh workers                         # recent worker activity (is a homelab draining?)
#
# Honest failure: if no worker claims the job within the timeout it exits non-zero
# with a clear notice (job left queued) — never fakes a solve (CLAUDE.md).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "solve.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY not set in .env." >&2; exit 2
fi
API="$URL/rest/v1"
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json")

enqueue() {  # url method postData -> job id
  local u="$1" m="${2:-request.get}" pd="${3:-}"
  [ "$m" = "get" ]  && m="request.get"
  [ "$m" = "post" ] && m="request.post"
  local body
  body=$(jq -n --arg u "$u" --arg m "$m" --arg pd "$pd" \
    '{url:$u, method:$m} + (if $pd=="" then {} else {post_data:$pd} end)')
  curl -fsS "${hdr[@]}" -X POST "$API/solve_jobs" -H "Prefer: return=representation" \
    -d "$body" | jq -r '.[0].id'
}

wait_for() {  # id timeout_s -> exit 0 + print solved HTML, or exit 1
  local id="$1" timeout="${2:-120}" waited=0
  while [ "$waited" -lt "$timeout" ]; do
    local row st
    row=$(curl -fsS "${hdr[@]}" "$API/solve_jobs?id=eq.$id&select=status,result,error")
    st=$(echo "$row" | jq -r '.[0].status')
    case "$st" in
      done)   echo "$row" | jq -r '.[0].result.response // ""'; return 0 ;;
      failed) echo "solve.sh: job $id FAILED — $(echo "$row"|jq -r '.[0].error')" >&2; return 1 ;;
    esac
    sleep 3; waited=$((waited+3))
  done
  echo "solve.sh: job $id not solved within ${timeout}s (still '$st'; is a homelab worker running? try 'tools/solve.sh workers'). Left queued." >&2
  return 1
}

case "${1:-}" in
  get)     id=$(enqueue "$2" get);            wait_for "$id" "${3:-120}" ;;
  post)    id=$(enqueue "$2" post "$3");       wait_for "$id" "${4:-120}" ;;
  enqueue) enqueue "$2" "${3:-get}" "${4:-}" ;;
  status)  curl -fsS "${hdr[@]}" "$API/solve_jobs?id=eq.$2&select=id,status,result,error,worker_id,attempts,created_at,completed_at" | jq '.[0]' ;;
  workers) curl -fsS "${hdr[@]}" "$API/solve_jobs?order=claimed_at.desc.nullslast&limit=10&select=id,status,worker_id,url,claimed_at,completed_at" | jq -c '.[]' ;;
  *) echo "usage: solve.sh get|post|enqueue|status|workers  (see header)"; exit 2 ;;
esac
