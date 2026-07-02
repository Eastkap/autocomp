#!/usr/bin/env bash
# db.sh — run SQL against the shared autocomp Supabase project via the Management API.
# Lets the loop provision schemas/tables per venture and run migrations WITHOUT the DB
# password or psql (works over HTTPS). Uses a Supabase Personal Access Token.
#
# Env (.env): SUPABASE_ACCESS_TOKEN (sbp_… PAT), SUPABASE_PROJECT_REF (project ref).
#
# Usage:
#   tools/db.sh query "select version()"        # run an inline statement / batch
#   tools/db.sh file path/to/migration.sql      # run a .sql file
#
# Honest-reporting: if the token/ref is missing it exits non-zero with a clear notice;
# on a Postgres/API error it prints the error and exits non-zero — never fakes success.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$TOKEN" ] || [ -z "$REF" ]; then
  echo "db.sh: SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF not set in .env — DDL is a manual step." >&2
  exit 2
fi
API="https://api.supabase.com/v1/projects/$REF/database/query"

case "${1:-}" in
  query) SQL="${2:?SQL required}";;
  file)  SQL="$(cat "${2:?path required}")";;
  *) echo "usage: db.sh {query \"<sql>\"|file <path.sql>}" >&2; exit 1;;
esac

resp="$(curl -s -w '\n%{http_code}' "$API" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$SQL" '{query:$q}')")"
code="$(printf '%s' "$resp" | tail -1)"
body="$(printf '%s' "$resp" | sed '$d')"
if [ "$code" != "200" ] && [ "$code" != "201" ]; then
  echo "db.sh: query failed (HTTP $code):" >&2
  printf '%s\n' "$body" | jq -r '.message // .error // .' 2>/dev/null >&2 || printf '%s\n' "$body" >&2
  exit 1
fi
printf '%s\n' "$body"
