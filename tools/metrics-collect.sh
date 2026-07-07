#!/usr/bin/env bash
# metrics-collect.sh — daily per-venture metrics → autocomp.metrics_daily (shared Supabase).
# For each active company in the registry with a known config below, collects for one UTC day:
#   cf_views   — Cloudflare eyeball HTTP requests to the venture's hostname (GraphQL,
#                httpRequestsAdaptiveGroups; free plan can't filter to HTML-only, so this is
#                the closest measurable proxy for page views — documented in tools/metrics.md)
#   cf_visits  — Cloudflare `sum(visits)` for the same slice
#   signups    — count(*) of the venture's signup table (Supabase)
#   revenue_usd— gross Stripe charges (paid, minus refunds) for the day, ventures with billing only
#   human_visits — rows in the venture's page-load beacon table (e.g. weeklybrief.visits) for
#                the day, EXCLUDING user agents that declare themselves as automation
#                (HeadlessChrome/Playwright/bot/curl/…). The beacon only fires from executed
#                JS, so this is the venture's real-traffic metric; filtering declared headless
#                keeps our own Playwright checks out of it. Ventures without a beacon → NULL.
# and upserts one row per (company_slug, day).
#
# Env (.env, sourced here): SUPABASE_URL, SUPABASE_SERVICE_KEY, CLOUDFLARE_API_TOKEN,
#   CLOUDFLARE_ZONE_ID; optional STRIPE_SECRET_KEY (revenue stays NULL without it).
#
# Usage:
#   tools/metrics-collect.sh              # collect for today (UTC)
#   tools/metrics-collect.sh 2026-07-01   # collect for a specific day
#
# Honest-reporting: missing required keys or a failed signup/CF call → loud stderr + non-zero
# exit. A measured 0 is written as 0; an unmeasurable value is written as NULL and reported.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true

DAY="${1:-$(date -u +%F)}"
URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"; CF_ZONE="${CLOUDFLARE_ZONE_ID:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "metrics-collect: SUPABASE_URL / SUPABASE_SERVICE_KEY not set in .env — cannot collect." >&2
  exit 2
fi
if [ -z "$CF_TOKEN" ] || [ -z "$CF_ZONE" ]; then
  echo "metrics-collect: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not set in .env — cannot collect." >&2
  exit 2
fi
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Accept-Profile: autocomp" -H "Content-Profile: autocomp")
FAIL=0

# Per-venture config: <slug> <hostname> <signup_table (schema.table)> <stripe: yes|no>
#   <visits_table (schema.table) | ->  (page-load beacon table; "-" = no beacon → human_visits NULL)
config_for() {
  case "$1" in
    weeklybrief) echo "brief.limed.tech weeklybrief.signups yes weeklybrief.visits";;
    autocomp)    echo "autocomp.limed.tech autocomp.waitlist no -";;
    *) return 1;;
  esac
}

# cf_metrics <hostname> → "views visits" on stdout, or non-zero on failure
cf_metrics() {
  local host="$1" resp
  resp="$(curl -s https://api.cloudflare.com/client/v4/graphql \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -n --arg zone "$CF_ZONE" --arg host "$host" --arg day "$DAY" '{
      query: "query($zone: String!, $host: String!, $day: String!) { viewer { zones(filter: {zoneTag: $zone}) { httpRequestsAdaptiveGroups(filter: {date: $day, clientRequestHTTPHost: $host, requestSource: \"eyeball\"}, limit: 10) { count sum { visits } } } } }",
      variables: {zone: $zone, host: $host, day: $day}}')")" || return 1
  if [ "$(printf '%s' "$resp" | jq '.errors | length')" -gt 0 ]; then
    printf '%s\n' "$resp" | jq -r '.errors[].message' >&2
    return 1
  fi
  # No groups returned = zero traffic for the day → a real measured 0.
  printf '%s' "$resp" | jq -r '.data.viewer.zones[0].httpRequestsAdaptiveGroups
    | if length == 0 then "0 0" else "\(.[0].count) \(.[0].sum.visits)" end'
}

# signup_count <schema.table> → integer count via db-side count(*)
signup_count() {
  tools/db.sh query "select count(*) as c from $1" | jq -r '.[0].c'
}

# human_visit_count <schema.table> → beacon rows for $DAY (UTC) whose UA does NOT declare
# itself as automation. Honesty choice: the beacon requires executed JS, so plain crawlers
# never fire it — the remaining pollution is headless browsers (e.g. our own Playwright
# verification, ua HeadlessChrome), so declared-automation UAs are excluded. Raw counts stay
# queryable in the beacon table itself.
human_visit_count() {
  tools/db.sh query "select count(*) as c from $1
    where (created_at at time zone 'UTC')::date = '$DAY'
      and coalesce(ua, '') !~* '(headless|playwright|phantom|bot|spider|crawl|curl|wget|python|googleother|google-)'" \
    | jq -r '.[0].c'
}

# stripe_revenue → gross USD (paid charges minus refunds) created on $DAY, or "null" if no key,
# or non-zero exit status on API failure.
stripe_revenue() {
  if [ -z "${STRIPE_SECRET_KEY:-}" ]; then echo "null"; return 0; fi
  local from to total=0 after="" url page
  from="$(date -u -d "$DAY 00:00:00" +%s)"; to="$(date -u -d "$DAY 00:00:00 + 1 day" +%s)"
  while :; do
    url="https://api.stripe.com/v1/charges?limit=100&created[gte]=$from&created[lt]=$to"
    [ -n "$after" ] && url="$url&starting_after=$after"
    page="$(curl -gfsS "$url" -u "$STRIPE_SECRET_KEY:")" || return 1
    total="$(printf '%s' "$page" | jq --argjson t "$total" \
      '$t + ([.data[] | select(.paid == true) | .amount - .amount_refunded] | add // 0)')"
    if [ "$(printf '%s' "$page" | jq -r '.has_more')" = "true" ]; then
      after="$(printf '%s' "$page" | jq -r '.data[-1].id')"
    else
      break
    fi
  done
  jq -n --argjson c "$total" '$c / 100'
}

# upsert <slug> <views|null> <visits|null> <signups> <revenue|null> <human_visits|null>
upsert_row() {
  curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/metrics_daily" \
    -H "Prefer: resolution=merge-duplicates,return=representation" \
    -d "$(jq -n --arg slug "$1" --arg day "$DAY" \
          --argjson views "$2" --argjson visits "$3" --argjson signups "$4" --argjson rev "$5" \
          --argjson human "$6" \
          '{company_slug:$slug, day:$day, cf_views:$views, cf_visits:$visits,
            signups:$signups, revenue_usd:$rev, human_visits:$human, collected_at:(now|todate)}')"
  echo
}

active="$(tools/registry.sh list | jq -r '.[] | select(.status == "active") | .slug')"
[ -n "$active" ] || { echo "metrics-collect: no active companies in registry." >&2; exit 1; }

for slug in $active; do
  if ! cfg="$(config_for "$slug")"; then
    echo "metrics-collect: [$slug] no metrics config (hostname/signup table unknown) — skipped." >&2
    FAIL=1; continue
  fi
  read -r host table has_stripe visits_table <<<"$cfg"

  views=null; visits=null
  if cf="$(cf_metrics "$host")"; then
    read -r views visits <<<"$cf"
  else
    echo "metrics-collect: [$slug] Cloudflare query failed for $host — cf_views/cf_visits NULL." >&2
    FAIL=1
  fi

  if ! signups="$(signup_count "$table")" || ! [[ "$signups" =~ ^[0-9]+$ ]]; then
    echo "metrics-collect: [$slug] signup count from $table failed — row skipped." >&2
    FAIL=1; continue
  fi

  revenue=null
  if [ "$has_stripe" = "yes" ]; then
    if ! revenue="$(stripe_revenue)"; then
      echo "metrics-collect: [$slug] Stripe charges read failed — revenue_usd NULL." >&2
      revenue=null; FAIL=1
    fi
    [ "$revenue" = "null" ] && [ -z "${STRIPE_SECRET_KEY:-}" ] && \
      echo "metrics-collect: [$slug] STRIPE_SECRET_KEY not set — revenue_usd NULL." >&2
  fi

  human=null
  if [ "$visits_table" != "-" ]; then
    if ! human="$(human_visit_count "$visits_table")" || ! [[ "$human" =~ ^[0-9]+$ ]]; then
      echo "metrics-collect: [$slug] human visit count from $visits_table failed — human_visits NULL." >&2
      human=null; FAIL=1
    fi
  fi

  upsert_row "$slug" "$views" "$visits" "$signups" "$revenue" "$human"
done

exit "$FAIL"
