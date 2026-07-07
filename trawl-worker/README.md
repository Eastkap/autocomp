# trawl-worker — homelab CAPTCHA/bot-wall solver (pull model)

The autocomp loop runs on a **datacenter VPS** (DigitalOcean). CAPTCHA/bot-wall
vendors (Cloudflare Turnstile, hCaptcha, DataDome) flag datacenter IPs hard, and a
real-Firefox solver would OOM that small box. So instead of hosting the solver next
to the loop, we host it where it works: a **residential-IP homelab**, pulling work
from a queue.

```
  VPS loop                Supabase                 Homelab (this)
 ┌──────────┐  enqueue   ┌───────────┐   claim    ┌─────────────────────┐
 │ solve.sh │ ─────────▶ │ solve_jobs│ ◀───────── │ worker → TRAWL(Camo-│
 │  get URL │            │  (queue)  │ ─result──▶ │ ufox Firefox)+Redis │
 └──────────┘  ◀─wait────└───────────┘   write    └─────────────────────┘
```

**Why pull, not push:** the homelab dials *out* to Supabase. No port-forwarding, no
tunnel/ngrok, no dynamic DNS, nothing about the homelab exposed to the internet.
The only traffic is outbound HTTPS (Supabase) + localhost (TRAWL).

## Setup (one time, ~5 min)

On any always-on homelab box with Docker and a **residential** internet connection:

```bash
git clone https://github.com/<autocomp-repo> && cd autocomp/trawl-worker
cp .env.example .env
# edit .env: paste SUPABASE_URL and SUPABASE_SECRET_KEY (both are in the autocomp .env)
docker compose up -d
docker compose logs -f worker      # should print "[worker …] up" then idle-poll
```

That's it. The worker now drains any job the loop enqueues, forever, across reboots
(`restart: unless-stopped`). Nothing else to maintain.

## Verify it's working

From the VPS (or anywhere with the autocomp `.env`):

```bash
tools/solve.sh get https://nowsecure.nl 60     # a Cloudflare-walled test page
tools/solve.sh workers                          # shows which box claimed recent jobs
```

If `get` prints solved HTML, the whole path is live. If it times out with
"is a homelab worker running?", check `docker compose logs worker` on the homelab.

## Resource notes

- `shm_size: 1gb` + `BROWSER_POOL_SIZE` (default 2) Camoufox browsers → give the box
  ~2–3 GB free RAM. Raise `BROWSER_POOL_SIZE` if you have more and want more parallelism.
- TRAWL image is a full Firefox build (~1–2 GB pull). First solve per domain is
  4–15 s (cold browser); repeats ~500 ms (Redis session cache).

## Security

- `SUPABASE_SECRET_KEY` is a server-side key. It lives only in the homelab `.env` and
  is never sent to a browser. The worker uses it solely to claim/complete `solve_jobs`.
- The worker makes no inbound connections; nothing to firewall open.
