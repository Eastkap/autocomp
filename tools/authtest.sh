#!/usr/bin/env bash
# authtest.sh — end-to-end test of what the OWNER'S BROWSER can fetch, without the owner.
# Signs in as the dedicated Supabase test user (LOOP_TEST_EMAIL/_PASSWORD in .env; SELECT-only
# RLS policies mirror the owner's read paths) and replays a REST fetch with that real
# `authenticated` JWT — the same auth path the kanban uses after Google sign-in.
#
# Usage:
#   tools/authtest.sh token                          # print a fresh JWT (for manual curls)
#   tools/authtest.sh get <rest-path> [profile]      # authed GET, e.g.:
#     tools/authtest.sh get "/rest/v1/tasks?select=id,title&limit=3"
#     tools/authtest.sh get "/rest/v1/activity?limit=3&select=at,task,actor" autocomp
#
# The test user must NOT be able to write — verify with:
#   tools/authtest.sh get ... (reads pass) + a manual PATCH (must 0-row/deny).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

: "${SUPABASE_URL:?SUPABASE_URL missing in .env}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY missing in .env}"
: "${LOOP_TEST_EMAIL:?LOOP_TEST_EMAIL missing in .env}"
: "${LOOP_TEST_PASSWORD:?LOOP_TEST_PASSWORD missing in .env}"

token() {
  curl -fsS "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
    -d "$(jq -n --arg e "$LOOP_TEST_EMAIL" --arg p "$LOOP_TEST_PASSWORD" '{email:$e,password:$p}')" \
  | jq -r .access_token
}

case "${1:-}" in
  token) token ;;
  get)
    path="${2:?rest path required}"; profile="${3:-}"
    jwt="$(token)"
    hdr=(-H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $jwt")
    [ -n "$profile" ] && hdr+=(-H "Accept-Profile: $profile")
    curl -fsS "${hdr[@]}" "$SUPABASE_URL$path"
    echo ;;
  *) echo "usage: authtest.sh {token|get <rest-path> [profile]}" >&2; exit 1 ;;
esac
