#!/usr/bin/env bash
# append.sh — flock-wrapped append to a shared single file.
#
# WHY: four role lanes (ceo/cto/qa/gtm) run concurrently and all write to the same
# single files — private/state/ledger.md digests, private/state/approvals.md PENDING
# rows, private/memory/ notes. An editor-style read-modify-write (or even two bare
# `>>` redirections racing on a multi-line block) can interleave or lose a line —
# losing a PENDING approval row is an approval-gate integrity failure (CLAUDE.md
# hard rules, plan R11). This helper takes an exclusive flock on the TARGET file,
# appends, and guarantees a trailing newline. Lanes MUST use this for every append
# to a shared file; never read-modify-write.
#
# Usage:
#   tools/append.sh <file> "text"          # append the argument (may be multi-line)
#   tools/append.sh <file> <<< "text"      # or read the text from stdin (heredoc/pipe)
#
# Exits 2 with a loud usage error when misused. Never truncates, never edits.
set -euo pipefail

file="${1:-}"
if [ -z "$file" ]; then
  echo "append.sh: ERROR — no target file given." >&2
  echo "usage: append.sh <file> \"text\"   |   append.sh <file> <<< \"text\"" >&2
  exit 2
fi
shift || true

if [ $# -gt 0 ]; then
  text="$*"
else
  if [ -t 0 ]; then
    echo "append.sh: ERROR — no text argument and stdin is a TTY (nothing to append)." >&2
    echo "usage: append.sh <file> \"text\"   |   append.sh <file> <<< \"text\"" >&2
    exit 2
  fi
  text="$(cat)"
fi

if [ -z "$text" ]; then
  echo "append.sh: ERROR — refusing to append empty text to $file." >&2
  exit 2
fi

dir="$(dirname "$file")"
[ -d "$dir" ] || { echo "append.sh: ERROR — directory $dir does not exist." >&2; exit 2; }

# Open the target itself in append mode and lock it: the fd is O_APPEND and the
# exclusive flock serializes writers, so multi-line blocks land contiguously.
# $(cat)/"$*" strip trailing newlines; printf '%s\n' restores exactly one.
exec 9>>"$file"
flock 9
printf '%s\n' "$text" >&9
