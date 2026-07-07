#!/usr/bin/env bash
# mirror.sh — publish the current master tree to the public repo (github.com/Eastkap/autocomp).
#
# Why a mirror at all: the working repo (origin = autocomp-live) has venture-data/PII in old
# commit contents (sanitized only at the tip, 7984ca0) — its history can never go public.
# The public repo carries a clean squashed root + one snapshot commit per sync.
#
# Snapshot sync: one commit on top of public/main with master's exact tree. Fast-forward
# only — never force. Ticks run this after committing; a no-op when trees already match.
# Safety: aborts loudly (no push) if the outgoing diff matches a secret pattern — an
# autonomous hourly committer needs a scrub buffer, not instant publish.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch public --quiet
if [ "$(git rev-parse master^{tree})" = "$(git rev-parse public/main^{tree})" ]; then
  echo "mirror: up to date (trees identical)"
  exit 0
fi

# Scan only added lines going public. Prefix patterns for real credentials; the generic JWT
# check is scoped to service/secret key assignments (the Supabase anon key is public by design).
if git diff public/main master | grep -E '^\+' | grep -qE \
  'sk-ant-api[0-9A-Za-z_-]{10,}|sk_live_[0-9A-Za-z]{10,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|xox[bp]-[0-9A-Za-z-]{10,}|SUPABASE_(SERVICE|SECRET)_KEY[[:space:]]*[:=][[:space:]]*["'\'']?eyJ'; then
  echo "mirror: ABORT — outgoing diff matches a secret pattern; review and publish manually" >&2
  exit 1
fi

subj="$(git log -1 --format=%s master)"
new="$(git commit-tree "$(git rev-parse master^{tree})" -p public/main -m "sync: ${subj}")"
git push public "$new":main
echo "mirror: pushed $new (tree of $(git rev-parse --short master))"
