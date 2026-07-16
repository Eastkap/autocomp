#!/usr/bin/env bash
# tasks.sh — the loop's side of the autocomp kanban (Supabase REST).
# The agent uses the SERVICE-ROLE key (server-side, bypasses RLS). Never expose it
# to the browser. Keys live in .env: SUPABASE_URL + SUPABASE_SERVICE_KEY.
#
# Usage:
#   tools/tasks.sh list [--tag <tag>]           # open tasks the agent must act on (todo/doing)
#   tools/tasks.sh list-all [--tag <tag>]       # EVERY open card (todo/doing/review/blocked, both assignees) — board triage
#   tools/tasks.sh add "title" [priority] [notes] [assignee] [tags]  # push a task; assignee=human (default) or agent
#                                               # assignee=agent = a self-reminder the next ticks pick up via list
#                                               # tags = comma-separated role lanes, e.g. "cto" or "gtm,qa"
#   tools/tasks.sh claim <role>                 # atomically claim the top card tagged <role> (claim_task RPC);
#                                               # qa claims review-status cards, other roles todo → doing
#   tools/tasks.sh update <id> <status> [notes] # set status (todo|doing|review|done|blocked) + optional notes
#   tools/tasks.sh tag <id> <tags-csv>          # REPLACE the card's tags array (e.g. "cto,qa"); the caller
#                                               # composes unions — fetch current tags first if you mean append
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

# tag_filter <cmd-args...> — echoes a PostgREST containment clause for `--tag <tag>`
# (tags=cs.{x} — curl needs --globoff so the braces reach PostgREST unglobbed).
tag_filter() {
  if [ "${1:-}" = "--tag" ]; then printf '&tags=cs.{%s}' "${2:?tag required after --tag}"; fi
}

case "${1:-list}" in
  list)
    tagf=$(tag_filter "${2:-}" "${3:-}")
    curl -fsS --globoff "${hdr[@]}" \
      "$API?assignee=eq.agent&status=in.(todo,doing)$tagf&order=priority.desc,created_at.asc&select=id,title,status,priority,tags,notes,created_by,created_at"
    echo
    ;;
  list-all)
    tagf=$(tag_filter "${2:-}" "${3:-}")
    curl -fsS --globoff "${hdr[@]}" \
      "$API?status=in.(todo,doing,review,blocked)$tagf&order=priority.desc,created_at.asc&select=id,title,status,priority,assignee,tags,notes,created_by,created_at"
    echo
    ;;
  add)
    title="${2:?title required}"; prio="${3:-0}"; notes="${4:-}"; assignee="${5:-human}"; tags="${6:-}"
    case "$assignee" in human|agent) ;; *) echo "tasks.sh: assignee must be human or agent" >&2; exit 1;; esac
    tags_json=$(jq -Rn --arg v "$tags" '$v | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))')
    curl -fsS "${hdr[@]}" -X POST "$API" -H "Prefer: return=representation" \
      -d "$(printf '{"title":%s,"priority":%s,"notes":%s,"status":"todo","assignee":"%s","created_by":"agent","tags":%s}' \
            "$(jq -Rn --arg v "$title" '$v')" "$prio" "$(jq -Rn --arg v "$notes" '$v')" "$assignee" "$tags_json")"
    echo
    ;;
  claim)
    role="${2:?role required (e.g. claim cto)}"
    out=$(curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/rpc/claim_task" \
      -d "$(jq -n --arg r "$role" '{p_role:$r}')")
    if [ "$(printf '%s' "$out" | jq 'length')" -eq 0 ]; then
      echo "tasks.sh: no claimable cards for $role"
    else
      printf '%s\n' "$out"
    fi
    ;;
  get)
    id=$(resolve_id "${2:?id required}")
    curl -fsS "${hdr[@]}" "$API?id=eq.$id&select=*"
    echo
    ;;
  tag)
    id=$(resolve_id "${2:?id required}"); tags="${3:?tags csv required (e.g. cto,qa)}"
    tags_json=$(jq -Rn --arg v "$tags" '$v | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))')
    curl -fsS "${hdr[@]}" -X PATCH "$API?id=eq.$id" -H "Prefer: return=representation" \
      -d "$(printf '{"tags":%s}' "$tags_json")"
    echo
    ;;
  update)
    id=$(resolve_id "${2:?id required}"); status="${3:?status required}"; notes="${4:-}"
    body=$(printf '{"status":%s' "$(jq -Rn --arg v "$status" '$v')")
    [ -n "$notes" ] && body="$body$(printf ',"notes":%s' "$(jq -Rn --arg v "$notes" '$v')")"
    # Entering todo (QA FAIL bounce) or review (fresh submission) clears the claim —
    # otherwise claim_task('qa')'s `claimed_by is distinct from 'qa'` re-claim guard
    # permanently hides a resubmitted card from QA (stale claimed_by from the prior pass).
    case "$status" in todo|review) body="$body"',"claimed_by":null,"claimed_at":null';; esac
    body="$body}"
    curl -fsS "${hdr[@]}" -X PATCH "$API?id=eq.$id" -H "Prefer: return=representation" -d "$body"
    echo
    ;;
  *)
    echo "usage: tasks.sh {list|list-all|add|claim|tag|get|update} ..." >&2; exit 1;;
esac
