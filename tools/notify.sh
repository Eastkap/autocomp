#!/usr/bin/env bash
# Push an autocomp notification to the human's phone via ntfy.sh.
# Real phone push (iOS/Android) for when the loop needs a human — e.g. an
# approval gate. Topic is a capability URL, so it lives in .env (NTFY_TOPIC),
# never git-tracked. See tools/notify.md.
#
# Usage:
#   tools/notify.sh "Title" "Body text" [priority] [tags]
#     priority: min|low|default|high|urgent   (default: high for approvals)
#     tags:     comma list of emoji shortcodes (default: robot)
#
# Exits 0 on success. If NTFY_TOPIC is unset it warns and exits 0 (the loop
# must not crash just because push isn't configured) — it never invents a send.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="$here/../.env"
[ -f "$env_file" ] && { set -a; . "$env_file"; set +a; }

if [ -z "${NTFY_TOPIC:-}" ]; then
  echo "notify.sh: NTFY_TOPIC not set in .env — skipping push (not failing)." >&2
  exit 0
fi

title="${1:-autocomp}"
body="${2:-}"
priority="${3:-high}"
tags="${4:-robot}"

curl -fsS \
  -H "Title: ${title}" \
  -H "Priority: ${priority}" \
  -H "Tags: ${tags}" \
  -d "${body}" \
  "https://ntfy.sh/${NTFY_TOPIC}" >/dev/null \
  && echo "notify.sh: pushed -> ${title}" \
  || { echo "notify.sh: push FAILED (curl error) — surface this, do not pretend it sent." >&2; exit 1; }
