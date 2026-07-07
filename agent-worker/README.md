# agent-worker — homelab agentic-browser worker (worker 2)

The **second** homelab worker. Where `trawl-worker/` is a fetch/solve tier
(GET/POST-and-return, beats bot walls), this one **drives a real logged-in browser**
to complete interactive, multi-step tasks: sign-ups, form fills, "log in and do X",
check a dashboard — the "act for me on the web" work the fetch tier can't do.

```
  VPS loop                 Supabase                Homelab (this)
  agent-task.sh do ─────▶ agent_jobs ◀──claim──── agent-worker: browser-use
   "sign up for X"        (task queue) ──result──▶  drives real Chrome profile
       ▲                                             (residential IP + logins)
       └──────────────── result + summary ◀──────────┘
```

Same pull model as worker 1: outbound-only, no exposed ports, reuses our Supabase.

## Design decisions (owner, 2026-07-07)

**Least-privilege tech ladder** — use the lowest rung that can finish the task:
`agentic browser (this)` → `Claude-in-Chrome MCP` → `full computer use`. This worker
is the bottom rung: a scoped Playwright/Chromium agent on ONE browser profile, not
the whole desktop.

**Identity ladder** — `boseclaw` (bot) by default, as much as possible. A worker only
claims jobs whose `identity` is in its `IDENTITIES` env list, enforced in the
`claim_agent_job` RPC — so a **bot-only box can never pick up a `personal` job**. Run a
`personal`-enabled worker only on a box you trust, and only enqueue `identity=personal`
for **safe, low-risk, reversible** tasks. Anything sensitive (spend, sending as you,
destructive) stays gated upstream — don't enqueue it.

## Setup

On an always-on **residential-IP** homelab box with Docker:

```bash
cd agent-worker
cp .env.example .env        # fill SUPABASE_URL, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, IDENTITIES
```

### One-time bootstrap: log the profile(s) in

The agent reuses a **pre-logged-in Chrome profile** per identity (`./profiles/boseclaw`,
optionally `./profiles/personal`). You must log in ONCE, by hand, because Google/GitHub
block automated logins (CLAUDE.md #14 — "insecure browser" wall):

```bash
# real Chrome, real you-at-the-keyboard, into the profile dir the worker will reuse:
google-chrome --user-data-dir="$PWD/profiles/boseclaw"
#   → sign into the boseclaw Google + GitHub (+ any directory accounts) in that window, then close it.
# (repeat with profiles/personal only if you enabled IDENTITIES=…,personal)
```

Then:

```bash
docker compose up -d
docker compose logs -f agent      # "[agent …] up — identities=[…]" then idle-poll
```

## Use it (from the VPS / loop)

```bash
tools/agent-task.sh do "Sign up for PeerPush and submit Weekly Brief using the kit copy" \
    https://peerpush.com/submit boseclaw 900
tools/agent-task.sh workers        # see the homelab agent claiming jobs
tools/agent-task.sh status <id>    # full result JSON
```

## Notes & guardrails

- **Cost:** the agent loop calls Claude via `ANTHROPIC_API_KEY` (your key) — every task
  burns tokens. Default model is `claude-sonnet-5` (cheaper); raise to `claude-opus-4-8`
  for hard flows. Watch the scoreboard.
- **This code is version-sensitive:** `browser-use` is pinned in `requirements.txt`.
  worker.py is written to that API but is validated on first real run here (it can't be
  exercised without a logged-in profile + residential browser). If browser-use's Agent
  API has shifted, the first `logs -f agent` will show it — bump the pin and re-test.
- Outbound-only; never open a port. `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` stay in
  this box's `.env`.
- Keep `IDENTITIES=boseclaw` unless you deliberately want personal-profile tasks on this box.
