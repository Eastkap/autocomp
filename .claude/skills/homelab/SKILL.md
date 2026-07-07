---
name: homelab
description: Set up or manage the homelab workers on a residential-IP box that the autocomp loop reaches through Supabase queues — worker 1 (trawl-worker, a CAPTCHA/bot-wall fetch+solve tier) and worker 2 (agent-worker, an agentic browser that drives a real logged-in profile to complete interactive tasks). Use when the user says "/homelab", "set up the homelab worker", "get TRAWL/the agent running at home", or wants to stand up / check / restart either worker.
---

# homelab — stand up the residential-IP solver worker

The autocomp loop runs on a datacenter VPS whose IP is flagged by CAPTCHA vendors and
which is too small to host a real browser. So the solver (TRAWL = Camoufox Firefox) runs
on the owner's **homelab** and the loop reaches it through a **pull queue** (Supabase
`solve_jobs`). This skill stands that worker up and manages it. Everything lives in
`trawl-worker/` — the muscle is `trawl-worker/setup.sh`; this skill drives it and verifies
the result end-to-end.

**Run this ON the homelab box** (the residential-IP machine with Docker), not on the VPS.
If invoked on the VPS, say so and stop — a datacenter IP defeats the purpose (see
`tools/trawl.md` "Pull-worker mode" and `private/memory` / the `trawl-pull-worker` note).

## Default action — set it up

1. **Locate the bundle.** If `trawl-worker/setup.sh` isn't in the current tree, clone the
   repo first: `git clone git@github.com:Eastkap/autocomp-live.git && cd autocomp-live`.
2. **Prereqs.** Confirm Docker + the Compose plugin are installed and the daemon is
   reachable (`docker info`). If missing, point the user at the install docs and stop —
   installing Docker is theirs to do.
3. **Gather the two secrets.** The worker needs `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
   (both come from the autocomp `.env`). If the user hasn't provided them, ask for them —
   the secret key is hidden on input. Never echo the secret back or write it anywhere but
   `trawl-worker/.env`.
4. **Run the installer:** `cd trawl-worker && ./setup.sh` (interactive) — or, if you already
   hold the two values in the environment, `SUPABASE_URL=… SUPABASE_SECRET_KEY=… ./setup.sh --yes --test`.
   It writes `.env` (chmod 600), `docker compose up -d --build`, waits for TRAWL health, and
   confirms the worker is polling.
5. **Prove it end-to-end.** Run the live test (`./setup.sh --test`, or answer yes at the
   prompt): it enqueues a real Cloudflare-walled page and waits for the worker to solve it.
   A green "LIVE SOLVE OK" means the whole path works: VPS → queue → homelab → TRAWL → back.
   Report the result honestly — if the solve fails, show `docker compose logs worker` /
   `logs trawl`, don't declare success.
6. **Tell the loop.** Once the live solve passes, the owner should reply **'up'** to the
   loop (or you, if you're the loop, flip the homelab kanban card to done) so the
   CAPTCHA-blocked directory signups resume automatically.

## Management verbs

- **status / is it working:** from any box with the autocomp `.env`, `tools/solve.sh workers`
  shows which worker claimed recent jobs; on the homelab, `docker compose ps`.
- **logs:** `./setup.sh logs` (follows the worker) or `docker compose logs -f trawl`.
- **restart / update:** re-run `./setup.sh` (idempotent — pulls newer images, recreates).
- **reconfigure creds:** `./setup.sh --reconfigure`.
- **stop:** `./setup.sh down`.
- **tune throughput:** raise `BROWSER_POOL_SIZE` in `.env` (more concurrent Camoufox
  browsers — needs more RAM), then re-run `./setup.sh`.

## Worker 2 — agentic browser (`agent-worker/`)

The second lane: an agentic browser that **drives a real logged-in profile** to complete
interactive tasks (sign-ups, form fills, "log in and do X") the fetch tier can't. Least-
privilege ladder (owner, 2026-07-07): **agentic browser (this) → Claude-in-Chrome MCP →
full computer use** — use the lowest rung that finishes the task. Identity ladder:
**boseclaw by default**; a worker only claims identities in its `IDENTITIES` env
(enforced in `claim_agent_job`), so a bot-only box can never touch a `personal` job.

Setup mirrors worker 1, with one extra step:
1. `cd agent-worker && cp .env.example .env` — fill `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `ANTHROPIC_API_KEY` (drives the agent loop — burns tokens), and `IDENTITIES`
   (default `boseclaw`).
2. **One-time login bootstrap** — the agent reuses a pre-logged-in Chrome profile per
   identity. Log in by hand once (automated logins get blocked, CLAUDE.md #14):
   `google-chrome --user-data-dir="$PWD/profiles/boseclaw"` → sign into the boseclaw
   Google/GitHub/etc. → close. (Repeat for `profiles/personal` only if enabling it.)
3. `docker compose up -d` → `docker compose logs -f agent` (shows "[agent …] up").
4. Prove it: from the VPS, `tools/agent-task.sh do "…" <url> boseclaw 900` — the homelab
   agent performs it and writes back a result. `tools/agent-task.sh workers` shows activity.

Manage: `docker compose logs -f agent` / `down` / re-run to update. Enqueue only **safe,
reversible** tasks under `identity=personal`; keep spend/send/destructive gated upstream.
worker.py is pinned to a `browser-use` version — if its Agent API shifted, the first run's
logs show it; bump `requirements.txt` and re-test (honest: this leg is validated on first
real homelab run, not on the VPS).

## Guardrails

- Residential IP is the point — don't set this up on a cloud/datacenter box.
- `SUPABASE_SECRET_KEY` is server-side; it stays in `trawl-worker/.env` on the homelab and is
  never sent to a browser, a prompt echo, a commit, or the kanban.
- The worker is outbound-only — never instruct the user to open a port or expose 8191 to the
  internet; it's published to `127.0.0.1` for local debugging only.
- Honest reporting: if the health check or live solve doesn't pass, say so with the logs —
  never report the worker as "up" unverified (CLAUDE.md hard rules + principle 13).
