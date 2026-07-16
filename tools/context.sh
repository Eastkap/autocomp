#!/usr/bin/env bash
# context.sh — the shared lane coordination store (Supabase autocomp.context) plus
# lane heartbeats/cursors (autocomp.lanes). Lanes talk through tagged INSERT-ONLY
# rows here instead of racing on one ledger file. Playbook: tools/context.md.
#
# Usage:
#   tools/context.sh post <lane> <kind> <body> [--slug s] [--tags a,b] [--refs '{"json":1}']
#   tools/context.sh read [--lane l] [--tag t] [--kind k] [--since ISO] [--limit n]
#   tools/context.sh sweep <lane>            # unread rows since the lane's cursor; stamps cursor at read time
#   tools/context.sh heartbeat <lane> [status] [note]   # upsert last_cycle_at=now(), host, status
#
# kind ∈ decision | result | blocker | handoff | learning.
# Append-only: there is deliberately NO update/delete verb (and the DB rejects both).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "context.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY not set — context store unavailable." >&2
  exit 2
fi
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Accept-Profile: autocomp" -H "Content-Profile: autocomp")
uenc() { jq -rn --arg v "$1" '$v|@uri'; }

case "${1:-}" in
  post)
    lane="${2:?lane required}"; kind="${3:?kind required}"; body="${4:?body required}"
    case "$kind" in decision|result|blocker|handoff|learning) ;;
      *) echo "context.sh: kind must be decision|result|blocker|handoff|learning (got: $kind)" >&2; exit 1;;
    esac
    shift 4
    slug=""; tags=""; refs="null"
    while [ $# -gt 0 ]; do case "$1" in
      --slug) slug="${2:?--slug needs a value}"; shift 2;;
      --tags) tags="${2:?--tags needs a,b,c}"; shift 2;;
      --refs) refs="${2:?--refs needs JSON}"; shift 2;;
      *) echo "context.sh post: unknown flag $1" >&2; exit 1;;
    esac; done
    payload="$(jq -n --arg l "$lane" --arg k "$kind" --arg b "$body" --arg s "$slug" --arg t "$tags" --argjson r "$refs" '
      {lane:$l, kind:$k, body:$b}
      + (if $s != "" then {company_slug:$s} else {} end)
      + (if $t != "" then {tags:($t|split(","))} else {} end)
      + (if $r != null then {refs:$r} else {} end)')"
    row="$(curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/context" -H "Prefer: return=representation" -d "$payload")"
    echo "posted: $(jq -c '.[0] | {id, lane, kind, tags}' <<<"$row")" ;;

  read)
    shift
    q="order=created_at.desc"; limit=20
    while [ $# -gt 0 ]; do case "$1" in
      --lane)  q="$q&lane=eq.${2:?}"; shift 2;;
      --tag)   q="$q&tags=cs.{${2:?}}"; shift 2;;
      --kind)  q="$q&kind=eq.${2:?}"; shift 2;;
      --since) q="$q&created_at=gt.$(uenc "${2:?}")"; shift 2;;
      --limit) limit="${2:?}"; shift 2;;
      *) echo "context.sh read: unknown flag $1" >&2; exit 1;;
    esac; done
    curl -fsSg "${hdr[@]}" "$URL/rest/v1/context?$q&limit=$limit"
    echo ;;

  sweep)
    lane="${2:?lane required}"
    # Ensure the lane row exists (a brand-new lane must be sweepable unseeded).
    curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/lanes?on_conflict=lane" \
      -H "Prefer: resolution=ignore-duplicates,return=minimal" \
      -d "$(jq -n --arg l "$lane" '{lane:$l}')"
    cur="$(curl -fsS "${hdr[@]}" "$URL/rest/v1/lanes?lane=eq.$lane&select=last_swept_at" | jq -r '.[0].last_swept_at // empty')"
    if [ -n "$cur" ]; then
      rows="$(curl -fsSg "${hdr[@]}" "$URL/rest/v1/context?created_at=gt.$(uenc "$cur")&order=created_at.asc")"
    else
      rows="$(curl -fsS "${hdr[@]}" "$URL/rest/v1/context?order=created_at.asc")"
    fi
    n="$(jq 'length' <<<"$rows")"
    if [ "$n" -gt 0 ]; then
      # Cursor semantics (load-bearing): stamp last_swept_at to the max created_at
      # OF THE ROWS RETURNED, at read time — never now()/cycle end — so rows other
      # lanes insert while a cycle is mid-flight are returned by the NEXT sweep,
      # not skipped. Zero rows returned → the cursor does not move.
      newest="$(jq -r '.[-1].created_at' <<<"$rows")"
      curl -fsS "${hdr[@]}" -X PATCH "$URL/rest/v1/lanes?lane=eq.$lane" -H "Prefer: return=minimal" \
        -d "$(jq -n --arg t "$newest" '{last_swept_at:$t}')"
    fi
    printf '%s\n' "$rows" ;;

  heartbeat)
    lane="${2:?lane required}"; status="${3:-}"; note="${4:-}"
    payload="$(jq -n --arg l "$lane" --arg s "$status" --arg n "$note" --arg h "$(hostname)" '
      {lane:$l, last_cycle_at:(now|todate), host:$h}
      + (if $s != "" then {last_status:$s} else {} end)
      + (if $n != "" then {note:$n} else {} end)')"
    curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/lanes?on_conflict=lane" \
      -H "Prefer: resolution=merge-duplicates,return=minimal" -d "$payload"
    echo "heartbeat: [$lane]${status:+ $status} @ $(hostname)" ;;

  *) echo "usage: context.sh {post <lane> <kind> <body> [--slug s] [--tags a,b] [--refs json]|read [--lane l] [--tag t] [--kind k] [--since ISO] [--limit n]|sweep <lane>|heartbeat <lane> [status] [note]}" >&2; exit 1;;
esac
