#!/usr/bin/env bash
# setup.sh — one command to stand up the trawl-worker on a homelab box.
# Run this ON YOUR HOMELAB (residential IP), not on the datacenter VPS. Idempotent
# and safe: never clobbers a complete .env; re-run any time to update/restart.
#
#   ./setup.sh                       # interactive — prompts for the 2 Supabase values
#   SUPABASE_URL=... SUPABASE_SECRET_KEY=... ./setup.sh --yes    # non-interactive
#   ./setup.sh --test                # after it's up, fire a live Cloudflare solve
#   ./setup.sh down                  # stop the worker + TRAWL
#   ./setup.sh logs                  # follow the worker log
#
# It: checks Docker → writes .env → docker compose up -d → waits for TRAWL health →
# confirms the worker is polling → (optionally) proves a real solve end-to-end.
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE="docker compose"

say()  { printf '  %s\n' "$*"; }
die()  { printf '  ! %s\n' "$*" >&2; exit 1; }

# ---- subcommands that don't need config -------------------------------------
case "${1:-}" in
  down) exec $COMPOSE down ;;
  logs) exec $COMPOSE logs -f worker ;;
esac

echo "trawl-worker — homelab setup"
echo

# ---- 1. prereqs -------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "Docker not found — install Docker Engine first (https://docs.docker.com/engine/install/)."
docker compose version >/dev/null 2>&1 || die "'docker compose' not available — install the Compose plugin."
docker info >/dev/null 2>&1 || die "Docker daemon not reachable — start Docker (or add your user to the 'docker' group)."
say "✓ Docker + Compose ready"

# ---- 2. config (SUPABASE_URL + SUPABASE_SECRET_KEY) -------------------------
# priority: existing .env (if complete) → env vars → interactive prompt
have_env() { [ -f .env ] && grep -q '^SUPABASE_URL=..*' .env && grep -q '^SUPABASE_SECRET_KEY=sb' .env 2>/dev/null; }

if have_env && [ "${1:-}" != "--reconfigure" ]; then
  say "✓ .env already configured — leaving it alone (use --reconfigure to change)"
else
  URL="${SUPABASE_URL:-}"; SK="${SUPABASE_SECRET_KEY:-}"
  if [ -z "$URL" ] || [ -z "$SK" ]; then
    if [ "${1:-}" = "--yes" ]; then die "SUPABASE_URL / SUPABASE_SECRET_KEY must be set in the environment for --yes."; fi
    echo "  Enter the two values from the autocomp .env (SUPABASE_SECRET_KEY input is hidden):"
    [ -z "$URL" ] && { read -rp "  SUPABASE_URL: " URL; }
    [ -z "$SK" ]  && { read -rsp "  SUPABASE_SECRET_KEY: " SK; echo; }
  fi
  [ -n "$URL" ] && [ -n "$SK" ] || die "both SUPABASE_URL and SUPABASE_SECRET_KEY are required."
  # write .env from the example, substituting the two values, preserving other defaults
  cp -n .env.example .env 2>/dev/null || true
  tmp=$(mktemp)
  awk -v u="$URL" -v s="$SK" '
    /^SUPABASE_URL=/        {print "SUPABASE_URL=" u; next}
    /^SUPABASE_SECRET_KEY=/ {print "SUPABASE_SECRET_KEY=" s; next}
    {print}
  ' .env > "$tmp" && mv "$tmp" .env
  chmod 600 .env
  say "✓ wrote .env (chmod 600)"
fi

# ---- 3. bring it up ---------------------------------------------------------
say "→ starting TRAWL + Redis + worker (first run pulls a Firefox image, ~1–2 GB)…"
$COMPOSE up -d --build

# ---- 4. wait for TRAWL health ----------------------------------------------
say "→ waiting for TRAWL to be healthy (up to 180s)…"
ok=""
for i in $(seq 1 60); do
  if curl -fsS --max-time 4 http://localhost:8191/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 3
done
[ -n "$ok" ] || die "TRAWL did not become healthy — check: $COMPOSE logs trawl"
say "✓ TRAWL healthy on localhost:8191"

# ---- 5. confirm the worker is polling --------------------------------------
sleep 2
if $COMPOSE logs worker 2>&1 | grep -q "\] up"; then
  say "✓ worker is up and polling the queue"
else
  say "… worker starting — check '$COMPOSE logs worker' if it doesn't claim jobs"
fi

# ---- 6. optional live end-to-end solve --------------------------------------
run_test() {
  # read the Supabase creds back out of .env for the REST round-trip
  U=$(grep '^SUPABASE_URL='        .env | cut -d= -f2-)
  K=$(grep '^SUPABASE_SECRET_KEY=' .env | cut -d= -f2-)
  api="$U/rest/v1"
  say "→ live test: enqueuing a Cloudflare-walled page (https://nowsecure.nl)…"
  id=$(curl -fsS -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
        -H "Prefer: return=representation" -X POST "$api/solve_jobs" \
        -d '{"url":"https://nowsecure.nl","method":"request.get"}' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$id" ] || { say "! could not enqueue test job — check Supabase creds"; return 1; }
  for i in $(seq 1 40); do
    row=$(curl -fsS -H "apikey: $K" -H "Authorization: Bearer $K" "$api/solve_jobs?id=eq.$id&select=status,error")
    case "$row" in
      *'"status":"done"'*)   say "✓ LIVE SOLVE OK — the full path works (VPS → queue → this box → TRAWL → back)"; return 0 ;;
      *'"status":"failed"'*) say "! solve failed: $row"; return 1 ;;
    esac
    sleep 3
  done
  say "! test job not solved within ~120s — check '$COMPOSE logs worker'"
  return 1
}
if [ "${1:-}" = "--test" ] || [ "${2:-}" = "--test" ]; then
  run_test || true
elif [ "${1:-}" != "--yes" ]; then
  read -rp "  Run a live solve test now? [Y/n] " a
  [ "${a:-y}" = "n" ] || [ "${a:-y}" = "N" ] || run_test || true
fi

cat <<'NEXT'

  Done. The worker now drains solve_jobs forever (restart: unless-stopped).
    logs:     ./setup.sh logs
    stop:     ./setup.sh down
    from VPS: tools/solve.sh get <url>     # enqueue + get solved HTML
              tools/solve.sh workers        # see this box claiming jobs

  Ping the loop 'up' and it will resume the CAPTCHA-blocked directory signups.
NEXT
