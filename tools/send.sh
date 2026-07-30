#!/usr/bin/env bash
# send.sh — the loop's ONE outbound-email path (Resend HTTP API, sender = autocomp.limed.tech).
#
# WHY: every landing page promises "we'll email you the day the free plan goes live", but the
# company had no way to send at all — so every waitlist signup was a person we could not contact
# (found Tick 127: a real lead sat 12 days). This is the send side of tools/mail.md.
#
# SCOPE GUARD (CLAUDE.md hard rule c): ONE recipient per invocation, no CC/BCC, no list send.
# Mass or cold outbound from autocomp.limed.tech stays gated and must NOT be shell-looped
# through this script — that is the exact reputation risk the gate exists for. Legitimate use:
# a reply to someone who contacted us, or a transactional message to an address that opted in.
#
# Env (.env): RESEND_API_KEY. MAIL_FROM overrides the default sender.
#
# Usage:
#   tools/send.sh <to> <subject> <body-file>     # body read from a file
#   tools/send.sh <to> <subject> -               # body read from stdin
#   tools/send.sh --dry-run <to> <subject> -     # print the payload, send nothing
#
# Honest-reporting: prints Resend's HTTP status + response body. A non-2xx exits non-zero.
# Never claim a send that did not return an id.
# shellcheck disable=SC1091
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }

dry=0
if [ "${1:-}" = "--dry-run" ]; then dry=1; shift; fi

to="${1:-}"; subject="${2:-}"; bodysrc="${3:-}"
if [ -z "$to" ] || [ -z "$subject" ] || [ -z "$bodysrc" ]; then
  echo "usage: send.sh [--dry-run] <to> <subject> <body-file|->" >&2; exit 2
fi
# One address, and nothing that could be read as a list by anything downstream: a separator
# check alone is not enough (a whitespace-separated "a@b.com c@d.com" would sail through and
# leave the fan-out decision to the provider's address parser). Demand a single plain address.
case "$to" in
  *,*|*\;*|*[[:space:]]*|*\<*|*\>*)
    echo "send.sh: refusing multiple/malformed recipients — one plain address per invocation (see header)" >&2; exit 2;;
esac
case "$to" in
  ?*@?*.?*) ;;
  *) echo "send.sh: '$to' is not an email address" >&2; exit 2;;
esac

from="${MAIL_FROM:-Weekly Brief <hello@autocomp.limed.tech>}"
if [ "$bodysrc" = "-" ]; then body="$(cat)"; else body="$(cat "$bodysrc")"; fi
[ -n "$body" ] || { echo "send.sh: empty body" >&2; exit 2; }

payload="$(TO="$to" FROM="$from" SUBJECT="$subject" BODY="$body" python3 -c '
import json, os
print(json.dumps({
    "from": os.environ["FROM"],
    "to": [os.environ["TO"]],
    "subject": os.environ["SUBJECT"],
    "text": os.environ["BODY"],
}))')"

if [ "$dry" = 1 ]; then
  echo "DRY RUN — nothing sent. Payload:"; echo "$payload"; exit 0
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "send.sh: RESEND_API_KEY unset — sending is not provisioned. Not faking a send." >&2
  exit 3
fi

out="$(mktemp)"; trap 'rm -f "$out"' EXIT
code="$(curl -sS -o "$out" -w '%{http_code}' -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$payload")"
echo "HTTP $code"
cat "$out"; echo
case "$code" in 2*) ;; *) echo "send.sh: send FAILED (HTTP $code)" >&2; exit 1;; esac
