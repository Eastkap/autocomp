---
name: homelab
description: Set up or manage the homelab workers on a residential-IP box that the autocomp loop reaches through Supabase queues — worker 1 (trawl-worker, a CAPTCHA/bot-wall fetch+solve tier) and worker 2 (agentic browser for interactive tasks: sign-ups, form fills, "log in and do X"). Worker 2's DEFAULT is the loop driving the captured Camoufox boseclaw session itself via `browser/camoufox.mjs act` (no API key, no daemon); the browser-use `agent-worker/` daemon is an optional always-on fallback. Use when the user says "/homelab", "set up the homelab worker", "get TRAWL/the agent running at home", "do the directory signups", or wants to stand up / check / restart either worker.
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

## Worker 2 — agentic browser (drive a real logged-in session)

The second lane: **act in a real logged-in browser** — sign-ups, form fills, "log in and do
X" the fetch tier can't. Identity ladder: **boseclaw by default**; only ever run
`identity=personal` on a box you trust, and enqueue it only for safe, reversible tasks
(spend/send/destructive stay gated upstream).

### Default path — the loop drives the captured Camoufox session (no daemon, no API key)

**This is the default and should be tried first.** The loop *is* an agent (Claude Code), so it
doesn't need a second API-keyed agent to think for it — it just needs hands in a logged-in
browser. Those hands are `browser/camoufox.mjs act`, driving the boseclaw session captured by
`login-capture.mjs` (`.secrets/boseclaw-state.json`). No `ANTHROPIC_API_KEY`, no separate
Chrome profile, no fresh login — Claude authors the steps, watches the screenshots, iterates.

```bash
# one-time (already done for boseclaw): capture the session by hand in a real Camoufox window
node browser/login-capture.mjs boseclaw https://accounts.google.com/   # → .secrets/boseclaw-state.json

# then, for any interactive task — write a steps file and run it in the logged-in session:
node browser/camoufox.mjs act steps.json --state .secrets/boseclaw-state.json [--save-state .secrets/boseclaw-state.json]
```
Steps are a JSON array (`goto/waitFor/fill/type/click/select/press/wait/shot/text/url` — see the
header of `camoufox.mjs`). It stops on the first failing step and screenshots so Claude can see
what happened and adjust. `--save-state` persists a *new* directory-account login back into the
session. CAPTCHA sites often pass on Camoufox's real fingerprint alone; when one truly blocks,
lean on worker 1 (the TRAWL solver) or hand the single blocked step to a human card. Consuming
the queue is just: read a `queued` `agent_jobs` row → drive it with `act` → PATCH it `done`/`failed`
with a result (verify live before claiming `done`, CLAUDE.md hard rules).

### Optional fallback — the browser-use daemon (`agent-worker/`, always-on)

Only stand this up when you want **unattended** pickup that survives with no Claude session open
(a true 24/7 headless drainer). It's a separate Python daemon that calls the Anthropic API
itself, so it costs an `ANTHROPIC_API_KEY` (your spend) and wants its own pre-logged-in **Chrome**
profile (note: that's Chrome `user_data_dir`, *not* the Camoufox storage-state above — different
engine, so it needs its own one-time `google-chrome --user-data-dir=…/profiles/boseclaw` login).
Setup: `cd agent-worker && cp .env.example .env` (fill the 3 secrets + `IDENTITIES`), do the Chrome
login, `docker compose up -d`, then `tools/agent-task.sh do "…" <url> boseclaw 900` to prove it.
`worker.py` pins a `browser-use` version — if its Agent API shifted, the first run's logs show it;
bump `requirements.txt` and re-test.

## Guardrails

- Residential IP is the point — don't set this up on a cloud/datacenter box.
- `SUPABASE_SECRET_KEY` is server-side; it stays in `trawl-worker/.env` on the homelab and is
  never sent to a browser, a prompt echo, a commit, or the kanban.
- The worker is outbound-only — never instruct the user to open a port or expose 8191 to the
  internet; it's published to `127.0.0.1` for local debugging only.
- Honest reporting: if the health check or live solve doesn't pass, say so with the logs —
  never report the worker as "up" unverified (CLAUDE.md hard rules + principle 13).
