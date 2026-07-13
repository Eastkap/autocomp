#!/usr/bin/env bash
# tasks.sh — the loop's side of the autocomp kanban (Supabase REST).
# The agent uses the SERVICE-ROLE key (server-side, bypasses RLS). Never expose it
# to the browser. Keys live in .env: SUPABASE_URL + SUPABASE_SERVICE_KEY.
#
# Usage:
#   tools/tasks.sh list                         # open tasks the agent must act on (todo/doing)
#   tools/tasks.sh list-all                     # EVERY open card (todo/doing/blocked, both assignees) — board triage
#   tools/tasks.sh add "title" [priority] [notes] [assignee]   # push a task; assignee=human (default) or agent
#                                               # assignee=agent = a self-reminder the next ticks pick up via list
#   tools/tasks.sh update <id> <status> [notes] # set status (todo|doing|done|blocked) + optional notes
#   tools/tasks.sh get <id>                     # full card incl. notes — read "- [y]/[n]" approval verdicts
#   <id> for get/update may be a unique prefix (e.g. first 8 chars); ambiguity fails loudly
#
# Honest-reporting: if keys are unset it prints a clear notice and exits non-zero —
# never fakes a sync (CLAUDE.md).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

URL="${SUPABASE_URL:-}"
KEY="${SUPABASE_SERVICE_KEY:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "tasks.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY not set in .env — kanban sync is a manual/gated step." >&2
  exit 2
fi
API="$URL/rest/v1/tasks"
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json")

# resolve_id <id-or-prefix> — uuid columns reject `like`, so a short prefix is resolved
# client-side against all card ids. Prints the full uuid or fails loudly.
resolve_id() {
  local id="$1" matches n
  if [ "${#id}" -eq 36 ]; then echo "$id"; return 0; fi
  matches=$(curl -fsS "${hdr[@]}" "$API?select=id" | jq -r --arg p "$id" '.[].id | select(startswith($p))')
  n=$(printf '%s' "$matches" | grep -c . || true)
  case "$n" in
    1) echo "$matches" ;;
    0) echo "tasks.sh: no card id starts with '$id' — pass the full uuid or a longer prefix." >&2; return 1 ;;
    *) echo "tasks.sh: ambiguous prefix '$id' matches $n cards:" >&2; echo "$matches" >&2; return 1 ;;
  esac
}

case "${1:-list}" in
  list)
    curl -fsS "${hdr[@]}" \
      "$API?assignee=eq.agent&status=in.(todo,doing)&order=priority.desc,created_at.asc&select=id,title,status,priority,notes,created_by,created_at"
    echo
    ;;
  list-all)
    curl -fsS "${hdr[@]}" \
      "$API?status=in.(todo,doing,blocked)&order=priority.desc,created_at.asc&select=id,title,status,priority,assignee,notes,created_by,created_at"
    echo
    ;;
  add)
    title="${2:?title required}"; prio="${3:-0}"; notes="${4:-}"; assignee="${5:-human}"
    case "$assignee" in human|agent) ;; *) echo "tasks.sh: assignee must be human or agent" >&2; exit 1;; esac
    curl -fsS "${hdr[@]}" -X POST "$API" -H "Prefer: return=representation" \
      -d "$(printf '{"title":%s,"priority":%s,"notes":%s,"status":"todo","assignee":"%s","created_by":"agent"}' \
            "$(jq -Rn --arg v "$title" '$v')" "$prio" "$(jq -Rn --arg v "$notes" '$v')" "$assignee")"
    echo
    ;;
  get)
    id=$(resolve_id "${2:?id required}")
    curl -fsS "${hdr[@]}" "$API?id=eq.$id&select=*"
    echo
    ;;
  update)
    id=$(resolve_id "${2:?id required}"); status="${3:?status required}"; notes="${4:-}"
    body=$(printf '{"status":%s' "$(jq -Rn --arg v "$status" '$v')")
    [ -n "$notes" ] && body="$body$(printf ',"notes":%s' "$(jq -Rn --arg v "$notes" '$v')")"
    body="$body}"
    curl -fsS "${hdr[@]}" -X PATCH "$API?id=eq.$id" -H "Prefer: return=representation" -d "$body"
    echo
    ;;
  *)
    echo "usage: tasks.sh {list|list-all|add|get|update} ..." >&2; exit 1;;
esac
