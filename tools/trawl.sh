#!/usr/bin/env bash
# trawl.sh — fetch a bot-protected / Cloudflare-challenged page through TRAWL
# (https://github.com/germondai/trawl), a FlareSolverr-v2-compatible solver.
#
# Config (.env or environment):
#   TRAWL_URL   base URL of a TRAWL instance (e.g. http://localhost:8191). REQUIRED.
#               If unset/unreachable, this script exits non-zero — the caller falls back
#               to plain curl / WebFetch (never fakes a solve; CLAUDE.md honest-reporting).
#
# Usage:
#   tools/trawl.sh health
#   tools/trawl.sh get  <url> [-s SESSION] [-t MAX_MS] [-H 'Key: Value'] ...   # prints solved HTML
#   tools/trawl.sh post <url> <postData> [-s SESSION] [-t MAX_MS] [-H 'K: V'] ...
#   tools/trawl.sh json get <url> [...]   # prints the full response JSON instead of just HTML
#
# Exit codes: 0 ok · 2 config (no TRAWL_URL) · 3 transport (unreachable) · 4 solve failed.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

BASE="${TRAWL_URL:-}"
if [ -z "$BASE" ]; then
  echo "trawl.sh: TRAWL_URL not set — no solver available; caller should fall back to curl/WebFetch." >&2
  exit 2
fi
BASE="${BASE%/}"

raw=0
if [ "${1:-}" = "json" ]; then raw=1; shift; fi
cmd="${1:-}"; shift || true

case "$cmd" in
  health)
    curl -fsS -m 10 "$BASE/health" || { echo "trawl.sh: $BASE unreachable" >&2; exit 3; }
    echo ;;
  get|post)
    url="${1:?url required}"; shift
    post_data=""
    if [ "$cmd" = "post" ]; then post_data="${1:?postData required for post}"; shift; fi
    session=""; maxtimeout=60000
    # collect -H headers into a JSON object
    hjson="{}"
    while [ $# -gt 0 ]; do
      case "$1" in
        -s) session="${2:?}"; shift 2;;
        -t) maxtimeout="${2:?}"; shift 2;;
        -H) k="${2%%:*}"; v="${2#*:}"; k="$(echo "$k" | sed 's/[[:space:]]*$//')"; v="$(echo "$v" | sed 's/^[[:space:]]*//')"
            hjson="$(jq -c --arg k "$k" --arg v "$v" '. + {($k): $v}' <<<"$hjson")"; shift 2;;
        *) echo "trawl.sh: unknown arg '$1'" >&2; exit 1;;
      esac
    done
    body="$(jq -cn \
      --arg cmd "request.$cmd" --arg url "$url" --argjson mt "$maxtimeout" \
      --arg session "$session" --arg pd "$post_data" --argjson headers "$hjson" '
      {cmd:$cmd, url:$url, maxTimeout:$mt}
      + (if $session != "" then {session:$session} else {} end)
      + (if $pd != "" then {postData:$pd} else {} end)
      + (if ($headers|length) > 0 then {headers:$headers} else {} end)')"
    resp="$(curl -sS -m "$(( maxtimeout/1000 + 15 ))" -X POST "$BASE/v1" \
            -H 'Content-Type: application/json' -d "$body")" \
      || { echo "trawl.sh: request to $BASE/v1 failed (transport)" >&2; exit 3; }
    st="$(jq -r '.solution.status // .status // empty' <<<"$resp" 2>/dev/null || true)"
    if [ -z "$st" ]; then echo "trawl.sh: unparseable response: $(head -c 300 <<<"$resp")" >&2; exit 4; fi
    if [ "$raw" = "1" ]; then echo "$resp"; exit 0; fi
    if [ "$st" -ge 200 ] 2>/dev/null && [ "$st" -lt 400 ]; then
      jq -r '.solution.response // ""' <<<"$resp"
    else
      echo "trawl.sh: solve returned status $st — $(jq -r '.message // ""' <<<"$resp")" >&2
      exit 4
    fi ;;
  *)
    echo "usage: trawl.sh {health | [json] get <url> [-s S][-t MS][-H 'K: V']... | [json] post <url> <data> ...}" >&2
    exit 1;;
esac
