#!/usr/bin/env bash
# morning-digest.sh — one daily push so the owner can govern the loops at a glance.
# Consolidates: funnel (impressions·clicks·signups·MRR) + burn/net, recent tick activity, and
# what's WAITING on the human (pending approvals + human kanban cards). All real numbers — pulled
# from the scoreboard, registry, approvals.md, and the kanban; never invented (CLAUDE.md).
#
# Install (once):  crontab -e  →  0 13 * * *  /home/j/autocomp/tools/morning-digest.sh
# Env: NTFY_TOPIC from .env. Reuses tools/notify.sh for the push.
set -uo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
DATE="$(date -u +%F)"

# --- funnel + burn (from the scoreboard) ---
SB="$(tools/scoreboard.sh 2>/dev/null)"
FUNNEL="$(printf '%s\n' "$SB" | grep -i 'FUNNEL' | sed 's/^[[:space:]]*//' | sed 's/  */ /g' | head -1)"
NET="$(printf '%s\n' "$SB" | grep -i 'Net position' | sed 's/^[[:space:]]*//' | head -1)"

# --- recent loop activity (registry, both ventures) ---
ACT="$(tools/registry.sh history weeklybrief 4 2>/dev/null | python3 -c "
import sys,json
try:
    rows=json.load(sys.stdin)
    shown=0
    for r in rows:
        t=r.get('task','')
        if t.lower().startswith('tick cost'): continue   # skip cost-telemetry rows
        print('  • '+t[:70]); shown+=1
        if shown>=4: break
except Exception: pass
" 2>/dev/null)"

# --- waiting on the human: pending approvals + human kanban cards ---
PEND="$(grep -c 'PENDING' private/state/approvals.md 2>/dev/null || echo 0)"
CARDS="$(curl -s -m 8 -H "apikey: ${SUPABASE_SERVICE_KEY:-}" -H "authorization: Bearer ${SUPABASE_SERVICE_KEY:-}" \
  "${SUPABASE_URL:-}/rest/v1/tasks?select=title&assignee=eq.human&status=in.(todo,doing)" 2>/dev/null \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d));[print('  • '+t['title'][:60]) for t in d[:4]]" 2>/dev/null)"
NCARDS="$(printf '%s\n' "$CARDS" | head -1)"
CARDLIST="$(printf '%s\n' "$CARDS" | tail -n +2)"

BODY="$(cat <<EOF
${FUNNEL:-FUNNEL: unavailable}
${NET:-}

Recent loop activity:
${ACT:-  • (none)}

Waiting on YOU: ${PEND:-0} approval(s), ${NCARDS:-0} board card(s)
${CARDLIST:-}

The fastest unlock is still the warm outreach (gated) — one tap.
EOF
)"

echo "=== digest ($DATE) ==="; echo "$BODY"
tools/notify.sh "autocomp daily — $DATE" "$BODY" 2>&1 | head -2
