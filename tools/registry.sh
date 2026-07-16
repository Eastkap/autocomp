#!/usr/bin/env bash
# registry.sh — the multi-venture brain (Supabase autocomp.companies / autocomp.activity).
# Tells a tick WHICH company to work and records what was done.
#
# Usage:
#   tools/registry.sh next                 # the company this tick should work (JSON row)
#   tools/registry.sh next --weighted      # staleness-biased RANDOM pick among active companies
#   tools/registry.sh list                 # all companies, priority order
#   tools/registry.sh log <slug> "<task>" ["<detail>"] [actor]   # record activity + touch last_*
#   tools/registry.sh logcost <slug> <tokens> <cost_usd> [actor] # harness cost row (actor default: harness)
#   tools/registry.sh history <slug> [n]   # last n activity rows (default 10)
#
# Priority rule (next): active companies only, highest `priority` first; ties broken by
# stalest `last_tick_at` (nulls first) — so nothing starves.
# Weighted rule (next --weighted, used by the role lanes): random pick where each active
# company's weight ∝ hours since last_tick_at (never-ticked = very stale) — biased to the
# starving venture but never deterministic, so four lanes don't all pile on one company.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "registry.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY not set — registry unavailable." >&2
  exit 2
fi
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Accept-Profile: autocomp" -H "Content-Profile: autocomp")

case "${1:-list}" in
  next)
    if [ "${2:-}" = "--weighted" ]; then
      rows="$(curl -fsS "${hdr[@]}" "$URL/rest/v1/companies?status=eq.active&select=*")"
      n="$(jq 'length' <<<"$rows")"
      if [ "$n" -eq 0 ]; then echo "[]"; exit 0; fi
      # weight = hours since last_tick_at (min 0.1 so a just-ticked venture stays pickable;
      # null last_tick_at = very stale → weight 720h). Random pick ∝ weight via awk.
      now="$(date +%s)"
      pick="$(jq -r --argjson now "$now" '
          .[] | [.slug,
                 (if .last_tick_at == null then 720
                  else ((($now - (.last_tick_at | sub("\\.[0-9]+";"") | sub("\\+00:00$";"Z") | fromdateiso8601)) / 3600) | if . < 0.1 then 0.1 else . end)
                  end)] | @tsv' <<<"$rows" \
        | awk -v seed="$RANDOM$$" 'BEGIN{srand(seed)}
            {slug[NR]=$1; w[NR]=$2; total+=$2}
            END{r=rand()*total; c=0; for(i=1;i<=NR;i++){c+=w[i]; if(r<=c){print slug[i]; exit}}}')"
      jq -c --arg s "$pick" '[.[] | select(.slug==$s)]' <<<"$rows"
    else
      curl -fsS "${hdr[@]}" "$URL/rest/v1/companies?status=eq.active&order=priority.desc,last_tick_at.asc.nullsfirst&limit=1"
      echo
    fi ;;
  list)
    curl -fsS "${hdr[@]}" "$URL/rest/v1/companies?order=priority.desc&select=slug,name,stage,status,priority,last_tick_at,last_task"
    echo ;;
  log)
    slug="${2:?slug required}"; task="${3:?task required}"; detail="${4:-}"; actor="${5:-loop}"
    curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/activity" -H "Prefer: return=minimal" \
      -d "$(jq -n --arg s "$slug" --arg t "$task" --arg d "$detail" --arg a "$actor" \
            '{slug:$s,task:$t,detail:$d,actor:$a}')"
    curl -fsS "${hdr[@]}" -X PATCH "$URL/rest/v1/companies?slug=eq.$slug" -H "Prefer: return=minimal" \
      -d "$(jq -n --arg t "$task" '{last_tick_at:(now|todate),last_task:$t}')"
    echo "logged: [$slug] $task" ;;
  logcost)
    # harness-only: attach a measured token/cost row to a company WITHOUT touching last_task.
    # Optional [actor] (default harness) lets the lane runners attribute per-lane burn
    # (actor=ceo|cto|qa|gtm) so the scoreboard stays honest per lane (plan R9).
    slug="${2:?slug required}"; tokens="${3:?tokens required}"; cost="${4:?cost_usd required}"; actor="${5:-harness}"
    task="tick cost (headless)"; [ "$actor" != "harness" ] && task="$actor cycle cost (headless)"
    curl -fsS "${hdr[@]}" -X POST "$URL/rest/v1/activity" -H "Prefer: return=minimal" \
      -d "$(jq -n --arg s "$slug" --arg t "$tokens" --arg c "$cost" --arg a "$actor" --arg k "$task" \
            '{slug:$s,task:$k,detail:("tokens="+$t+" cost_usd="+$c),actor:$a,tokens:($t|tonumber),cost_usd:($c|tonumber)}')"
    echo "logged cost: [$slug] actor=$actor tokens=$tokens cost_usd=$cost" ;;
  history)
    slug="${2:?slug required}"; n="${3:-10}"
    curl -fsS "${hdr[@]}" "$URL/rest/v1/activity?slug=eq.$slug&order=at.desc&limit=$n&select=at,task,detail,actor"
    echo ;;
  *) echo "usage: registry.sh {next [--weighted]|list|log <slug> <task> [detail] [actor]|logcost <slug> <tokens> <cost_usd> [actor]|history <slug> [n]}" >&2; exit 1;;
esac
