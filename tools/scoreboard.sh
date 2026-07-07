#!/usr/bin/env bash
# scoreboard.sh — the burn-vs-income score, per venture (Principle 17).
# Answers the only question that matters day-to-day: for each company, how many tokens/$ have we
# burned, how much has come IN, and is GTM actually running — or are we just building?
#
# Sources (all real, never invented — CLAUDE.md "no invented results"):
#   - autocomp.activity  → tokens + cost_usd summed per slug (measured per-tick model cost)
#   - autocomp.metrics_daily → cf_visits / human_visits / signups / revenue_usd per company_slug
#   - approved spend (domains/ads) is NOT yet wired per-venture → shown as the pnl figure or 0 with a note
#
# Usage: tools/scoreboard.sh            # print the table + the Rule-17 gate verdict
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; } || true
URL="${SUPABASE_URL:-}"; KEY="${SUPABASE_SERVICE_KEY:-}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "scoreboard.sh: SUPABASE_URL / SUPABASE_SERVICE_KEY not set — scoreboard unavailable." >&2
  exit 2
fi

python3 - "$URL" "$KEY" <<'PY'
import sys, json, urllib.request, collections
URL, KEY = sys.argv[1], sys.argv[2]
def get(path):
    req = urllib.request.Request(URL + "/rest/v1/" + path, headers={
        "apikey": KEY, "authorization": "Bearer " + KEY, "accept-profile": "autocomp"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

companies = {c["slug"]: c for c in get("companies?select=slug,name,stage,status")}
# model burn (tokens + cost) per slug, from the per-tick cost rows
burn = collections.defaultdict(lambda: {"tokens": 0, "cost": 0.0, "ticks": 0})
for r in get("activity?select=slug,tokens,cost_usd&tokens=not.is.null&limit=1000"):
    b = burn[r["slug"]]; b["tokens"] += r.get("tokens") or 0
    b["cost"] += float(r.get("cost_usd") or 0); b["ticks"] += 1
# traffic / signups / revenue per company, summed across days
met = collections.defaultdict(lambda: {"cfv": 0, "hv": 0, "signups": 0, "rev": 0.0, "days": 0})
for r in get("metrics_daily?select=company_slug,cf_visits,human_visits,signups,revenue_usd&limit=2000"):
    m = met[r["company_slug"]]; m["cfv"] += r.get("cf_visits") or 0
    m["hv"] += r.get("human_visits") or 0; m["signups"] += r.get("signups") or 0
    m["rev"] += float(r.get("revenue_usd") or 0); m["days"] += 1

slugs = sorted(set(list(companies) + list(burn) + list(met)),
               key=lambda s: -burn[s]["cost"])
print(f"\n  autocomp — venture scoreboard  (burn vs income; Principle 17)\n")
hdr = f"  {'venture':<13} {'stage':<8} {'tokens':>12} {'model$':>8} {'rev$':>7} {'net$':>9} {'humans':>7} {'signups':>8}  verdict"
print(hdr); print("  " + "-"*(len(hdr)+22))
tt = tc = tr = 0
for s in slugs:
    c = companies.get(s, {}); b = burn[s]; m = met[s]
    net = m["rev"] - b["cost"]
    tt += b["tokens"]; tc += b["cost"]; tr += m["rev"]
    if b["cost"] == 0 and m["days"] == 0:
        verdict = "PRE-GTM (no ticks/metrics yet)"
    elif m["rev"] > 0:
        verdict = f"EARNING — {m['rev']/b['cost']*100:.0f}% cost recovered" if b["cost"] else "EARNING"
    elif m["signups"] > 0:
        verdict = f"SELL — {m['signups']} signup(s), $0 rev: convert, don't build"
    elif b["cost"] == 0:
        verdict = "SELL — GTM live, 0 signups: distribution first"
    else:
        verdict = f"SELL — ${b['cost']:.2f} burned, $0 in, 0 signups: distribution first"
    print(f"  {s:<13} {c.get('stage','-'):<8} {b['tokens']:>12,} {b['cost']:>8.2f} "
          f"{m['rev']:>7.2f} {net:>9.2f} {m['hv']:>7} {m['signups']:>8}  {verdict}")
print("  " + "-"*(len(hdr)+22))
print(f"  {'TOTAL':<13} {'':<8} {tt:>12,} {tc:>8.2f} {tr:>7.2f} {tr-tc:>9.2f}")
print(f"\n  Net position: ${tr-tc:+.2f}  (revenue ${tr:.2f} − model burn ${tc:.2f}; approved cash")
print(f"  spend/domains not yet wired per-venture — see private/state/pnl.md, $0 to date).")
print(f"\n  Rule 17 gate: NO new venture or new feature until every active venture above shows")
print(f"  live GTM + flowing stats. A 'SELL' verdict means the next move is distribution, not build.\n")
PY

# --- funnel: top-of-funnel from GSC (impressions → clicks), domain-wide, last 28d ---
# The compass (CLAUDE.md tick §3): every tick should move one of impressions·clicks·signups·MRR.
FUNNEL="$(python3 tools/gsc.py analytics sc-domain:limed.tech --dim query --days 28 2>/dev/null || true)"
if [ -n "$FUNNEL" ]; then
  echo "$FUNNEL" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin); t=d.get('totals',{})
    imp=t.get('impressions',0); clk=t.get('clicks',0); ctr=(clk/imp*100) if imp else 0
    r=d.get('range',['',''])
    print(f'  FUNNEL (GSC {r[0]}→{r[1]}, all limed.tech):  impressions={imp:,}  →  clicks={clk:,}  (CTR {ctr:.1f}%)  →  signups/MRR per venture above')
    if imp==0:
        print('    0 impressions = not indexed yet → Lane-1 priority: get-crawled (Indexing API + backlinks), then titles/CTR.')
except Exception as e:
    print('  FUNNEL: GSC parse failed —', str(e)[:70])
"
else
  echo '  FUNNEL: GSC unavailable (auth/API) — impressions ~0 until indexed.'
fi
