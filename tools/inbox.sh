#!/usr/bin/env bash
# inbox.sh — the loop's read side of the bot inbox (hello@limed.tech → autocomp.inbox).
# The Cloudflare Email Worker (mail/worker.js) writes parsed messages + extracted links here;
# the loop reads them to click directory confirmation links, then marks them processed.
#
# Usage:
#   tools/inbox.sh list [n]          # newest n messages (default 10): id, from, subject, links
#   tools/inbox.sh unprocessed [n]   # only rows not yet handled
#   tools/inbox.sh links <id>        # just the links array for one message
#   tools/inbox.sh done <id>         # mark a message processed
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "inbox.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY unset — inbox unavailable." >&2; exit 2
fi
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: autocomp" -H "Content-Profile: autocomp")

case "${1:-list}" in
  list|unprocessed)
    n="${2:-10}"; filter=""
    [ "$1" = "unprocessed" ] && filter="processed=eq.false&"
    curl -fsS "${hdr[@]}" \
      "$URL/rest/v1/inbox?${filter}order=received_at.desc&limit=$n&select=id,received_at,from_addr,subject,links,processed" ;;
  links)
    id="${2:?id required}"
    curl -fsS "${hdr[@]}" "$URL/rest/v1/inbox?id=eq.$id&select=links" | jq -r '.[0].links[]?' ;;
  done)
    id="${2:?id required}"
    curl -fsS "${hdr[@]}" -X PATCH "$URL/rest/v1/inbox?id=eq.$id" -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" -d '{"processed":true}' && echo "marked $id processed" ;;
  *) echo "usage: inbox.sh {list [n]|unprocessed [n]|links <id>|done <id>}" >&2; exit 1;;
esac
echo