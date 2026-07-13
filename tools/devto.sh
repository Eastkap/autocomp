#!/usr/bin/env bash
# devto.sh — CLI over the Forem API (dev.to) for publishing GTM/GEO content.
# Auth: dev.to personal API key, header `api-key: $DEVTO_API_KEY`. Key belongs to the
# OWNER'S PERSONAL account (@eastkap) — see tools/devto.md for identity policy.
#
# Usage:
#   tools/devto.sh me                        # GET /users/me — identity sanity check
#   tools/devto.sh list [n]                  # published articles (default 10): id, published, title, url, views
#   tools/devto.sh drafts [n]                # unpublished articles (default 10): id, published, title, url
#   tools/devto.sh get <id>                  # full article JSON
#   tools/devto.sh post <file.md> [--publish]  # create article from markdown file (draft unless --publish)
#   tools/devto.sh publish <id>              # set published:true
#   tools/devto.sh unpublish <id>            # set published:false
#   tools/devto.sh update <id> <file.md>     # replace body_markdown from a file
#
# post: if <file.md> starts with Jekyll front matter (`---`), the whole file is sent as
# body_markdown and front matter drives title/tags/etc. Otherwise the first `# heading` line
# is used as the title and the remainder as the body.
#
# Notes: dev.to rate-limits article creation — a 429 means wait and retry manually; this
# script does not build retry logic, it just surfaces the error.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

KEY="${DEVTO_API_KEY:-}"
if [ -z "$KEY" ]; then
  echo "devto.sh: DEVTO_API_KEY not set in .env — dev.to publishing is a manual/gated step." >&2
  exit 2
fi
API="https://dev.to/api"
hdr=(-H "api-key: $KEY")
whdr=(-H "api-key: $KEY" -H "Content-Type: application/json")

# build_payload <file.md> <published:true|false> — prints the JSON body for post/update.
build_payload() {
  local file="$1" published="$2"
  if head -n1 "$file" | grep -q '^---[[:space:]]*$'; then
    jq -n --rawfile body "$file" --argjson published "$published" \
      '{article:{body_markdown:$body,published:$published}}'
  else
    local title body
    title=$(grep -m1 '^# ' "$file" | sed 's/^# *//')
    [ -n "$title" ] || { echo "devto.sh: no '# heading' found in $file to use as title" >&2; exit 1; }
    body=$(sed '0,/^# /d' "$file")
    jq -n --arg title "$title" --arg body "$body" --argjson published "$published" \
      '{article:{title:$title,body_markdown:$body,published:$published}}'
  fi
}

case "${1:-}" in
  me)
    curl -fsS "${hdr[@]}" "$API/users/me" ;;
  list)
    n="${2:-10}"
    curl -fsS "${hdr[@]}" "$API/articles/me?per_page=$n" \
      | jq -r '.[] | [.id, .published, .title, .url, .page_views_count] | @tsv' ;;
  drafts)
    n="${2:-10}"
    curl -fsS "${hdr[@]}" "$API/articles/me/unpublished?per_page=$n" \
      | jq -r '.[] | [.id, .published, .title, .url] | @tsv' ;;
  get)
    id="${2:?id required}"
    curl -fsS "${hdr[@]}" "$API/articles/$id" ;;
  post)
    file="${2:?file.md required}"; [ -f "$file" ] || { echo "devto.sh: no such file: $file" >&2; exit 1; }
    published=false; [ "${3:-}" = "--publish" ] && published=true
    resp=$(curl -fsS "${whdr[@]}" -X POST "$API/articles" -d "$(build_payload "$file" "$published")")
    echo "$resp" | jq -r '"id=\(.id) url=\(.url)"' ;;
  publish)
    id="${2:?id required}"
    resp=$(curl -fsS "${whdr[@]}" -X PUT "$API/articles/$id" -d '{"article":{"published":true}}')
    echo "$resp" | jq -r '"id=\(.id) published=\(.published) url=\(.url)"' ;;
  unpublish)
    id="${2:?id required}"
    resp=$(curl -fsS "${whdr[@]}" -X PUT "$API/articles/$id" -d '{"article":{"published":false}}')
    echo "$resp" | jq -r '"id=\(.id) published=\(.published) url=\(.url)"' ;;
  update)
    id="${2:?id required}"; file="${3:?file.md required}"; [ -f "$file" ] || { echo "devto.sh: no such file: $file" >&2; exit 1; }
    body=$(jq -n --rawfile b "$file" '{article:{body_markdown:$b}}')
    resp=$(curl -fsS "${whdr[@]}" -X PUT "$API/articles/$id" -d "$body")
    echo "$resp" | jq -r '"id=\(.id) url=\(.url)"' ;;
  *)
    echo "usage: devto.sh {me|list [n]|drafts [n]|get <id>|post <file.md> [--publish]|publish <id>|unpublish <id>|update <id> <file.md>}" >&2
    exit 1 ;;
esac
echo
