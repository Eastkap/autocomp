# Tool: herdr + tmux — running the four role lanes (supervision surface)

The four role lanes (ceo / cto / qa / gtm) are each ONE long-lived `tools/role-loop.sh <role>`
process (see that script's header: flock + DB lease + pause sentinel + burn gate, spawning
bounded `claude -p` cycles). This playbook covers WHERE those runners live:
**visibly in herdr tabs on the owner's machine**, or **headlessly under tmux on the VPS** —
same runner either way, and never both at once (see the one-host rule below).

Supervision is observability only: a pane hosts a runner; killing the pane kills that lane
(the U7 watchdog alerts on the stale heartbeat). Nothing in herdr/tmux is load-bearing for
safety — the gates live in `role-loop.sh` and the cycle prompts.

## THE ONE-HOST RULE (read this before starting anything)

A lane runs on exactly ONE host, enforced by the DB lease (`autocomp.lanes.host` +
`lease_until`, TTL = 2× the lane interval). A second host that tries to run a leased lane
refuses **loudly** — pane output looks like this, plus an ntfy push ("lane lease conflict"):

```
2026-07-16T00:40:11Z [qa] FATAL — lane 'qa' is leased to host 'ubuntu-s-2vcpu-4gb-nyc3-01'
until 2026-07-16T02:40:11+00:00. Refusing to double-run. Pause that runner first.
```

So before bringing lanes up on the laptop, take them down on the VPS (and vice versa):

```
ssh <vps> '/home/j/autocomp/tools/lanes-tmux.sh stop'    # graceful: TERM → lease released NOW
```

Prefer `stop` over pause sentinels for a host handover: a **stopped** runner releases its
lease immediately (the TERM trap in role-loop.sh), while a **paused** runner keeps its last
lease until it expires (up to 2× interval) — pausing alone can leave the other host refused
for hours. Sentinels are for "hold this lane, same host" (see Pause/rollback below).

If the VPS lanes stay up, herdr-on-laptop is **read-only supervision**: watch the kanban lane
strip, `tools/lanes-tmux.sh status` over ssh, or `ssh <vps> 'ls -t /home/j/autocomp/private/state/lane-runs/ | head'`.

## herdr (owner machine — the visible surface)

herdr (github.com/ogulcancelik/herdr · herdr.dev) is a Rust terminal workspace manager built
for running multiple CLI agents in parallel: tmux-style prefix keys, persistent sessions that
survive SSH disconnect/detach ("detach, agents keep running — reattach from any terminal"),
per-agent status at a glance (working / blocked / done / unknown), plus a socket API.
Dual-licensed **AGPL-3.0-or-later + commercial**. ~12k GitHub stars.

Install (from the README, fetched 2026-07-16 — run on the owner machine, not executed there
by the loop):

```
curl -fsSL https://herdr.dev/install.sh | sh     # or: brew install herdr / mise use -g herdr
```

Layout — one agent per lane inside the persistent session (command syntax verified against
herdr 0.7.1, which happens to be installed on the VPS too):

```
cd ~/autocomp && herdr          # launch/attach the persistent session
# then, from any shell (socket API), one tab per lane:
herdr agent start ceo --cwd ~/autocomp -- tools/role-loop.sh ceo
herdr agent start cto --cwd ~/autocomp -- tools/role-loop.sh cto
herdr agent start qa  --cwd ~/autocomp -- tools/role-loop.sh qa
herdr agent start gtm --cwd ~/autocomp -- tools/role-loop.sh gtm
```

Detach with `ctrl+b q`; `herdr` reattaches (works over a new ssh connection — that's the
point of the persistent session). `herdr agent list` shows the four lanes and their detected
state.

**Agent-detection caveat (deferred):** herdr classifies agent state (working/blocked/idle) by
watching the terminal. On 0.7.1 there is no `~/.config/herdr/agent-detection/` directory by
default (probed on the VPS install); detection tuning for the `claude` TUI that role-loop
spawns is untuned and the status column may read `unknown` between cycles. That's cosmetic —
plan Open Questions defers manifest tuning until someone watches the live TUI. The lanes run
fine regardless.

**Honest failure notes:** closing a herdr tab kills that lane's runner — the lane is then dead
until you restart it. The watchdog ntfy's on the stale heartbeat and now also tries a restart,
but its recovery path is the VPS tmux session only (`lanes-tmux.sh ensure`); it cannot revive a
herdr tab on the laptop. herdr does NOT autostart at boot; the laptop is a foreground surface,
the VPS is the 24/7 home.

## VPS (headless, 24/7) — tmux via `tools/lanes-tmux.sh`

One tmux session `lanes`, one window per role (roles are data: one window per
`tools/role-prompts/<role>.md`). The helper wraps the whole lifecycle:

```
tools/lanes-tmux.sh start     # create session (GUARDED — see below)
tools/lanes-tmux.sh ensure    # self-heal: recreate only MISSING/DEAD lane windows (GUARDED, idempotent)
tools/lanes-tmux.sh status    # tmux windows + pause sentinels + DB lease/heartbeat summary
tools/lanes-tmux.sh stop      # TERM each lane's process group (releases leases), then kill-session
```

**Self-healing (added 31 Jul, card 27e25d22).** `start` is idempotent at the *session* level, so
for two weeks a single lane window dying left nothing that could bring it back: gtm crashed on
28 Jul and again on 30 Jul, and the second outage ran ~11h with the phone alert already sent and
the distribution engine simply off. Three changes close that:
- `ensure` respawns only the windows that are missing or whose pane is dead, rate-limited per
  role by `ENSURE_MIN_GAP_MIN` (default 60) so a crash-looping lane is not hammered.
- `watchdog.sh` (already cron'd `*/30`) now calls `ensure` **before** it alerts, and reports what
  the restart did in the push body — detection became recovery.
- `role-loop.sh` appends one line per exit to `private/state/lane-runs/<role>-exits.log`
  (timestamp, exit code, host, pid). Previously a dead runner left nothing at all: `remain-on-exit`
  was being set on the session, which tmux applies to the *current window only*, so only `ceo`
  ever had it and the other three windows closed without scrollback. It is now set per window.
  SIGKILL still leaves no line — that case is what the heartbeat is for.

Root cause of the gtm crashes themselves is still **unknown** — the evidence was destroyed by the
vanishing window both times. The next crash will leave an exit code in `<role>-exits.log`.

**The LANES_ENABLED guard:** `start` refuses (exit 3, loud message) unless `LANES_ENABLED=1`
is set in `.env` (or the environment), or `--force` is passed for a supervised test. This is
the pre-cutover brake: until plan U9 retires the tick heartbeat, nothing — including the
@reboot cron line — may free-run the lanes. **U9 cutover = set `LANES_ENABLED=1` in `.env`
AND remove the four pause sentinels.** Until then the sentinels stay in place; a `--force`
start with sentinels present brings up runners that idle harmlessly ("paused … sleeping"),
spawning zero cycles (verified 2026-07-16).

What `start` does, equivalently by hand:

```
tmux new-session -d -s lanes -n ceo -c /home/j/autocomp 'exec /home/j/autocomp/tools/role-loop.sh ceo'
tmux set-option  -t lanes remain-on-exit on    # dead panes keep their last output visible
tmux new-window  -t lanes -n cto -c /home/j/autocomp 'exec /home/j/autocomp/tools/role-loop.sh cto'
tmux new-window  -t lanes -n qa  -c /home/j/autocomp 'exec /home/j/autocomp/tools/role-loop.sh qa'
tmux new-window  -t lanes -n gtm -c /home/j/autocomp 'exec /home/j/autocomp/tools/role-loop.sh gtm'
```

`remain-on-exit on` matters: a lane that exits (e.g. the FATAL foreign-lease refusal above)
leaves its last lines on a dead pane instead of vanishing — `status` shows `dead=1`.
Watch a lane live: `tmux attach -t lanes` (Ctrl-b, then window number; detach Ctrl-b d) —
sessions survive SSH disconnect by design (verified: created from one shell, listed from
another after the first exited).

**Boot autostart (installed 2026-07-16, user crontab — no sudo needed):**

```
@reboot /home/j/autocomp/tools/lanes-tmux.sh start >> /home/j/autocomp/private/state/lanes-tmux-boot.log 2>&1
```

Today (pre-cutover) a reboot just logs the guard refusal — harmless by construction. After
U9 sets `LANES_ENABLED=1`, the same line brings all lanes back automatically (R13).

**Stopping cleanly** — TERM is the contract: role-loop traps it, releases its DB lease, exits
0. All of these deliver it:

```
tools/lanes-tmux.sh stop                      # preferred: group-TERM every pane, wait, kill-session
tmux send-keys -t lanes:qa C-c                # one lane only (INT is trapped like TERM)
kill -TERM <role-loop pid>                    # one lane, by pid
tmux kill-session -t lanes                    # group signal on all panes — U5 verified leases release
```

## Pause / rollback

- **Pause one lane (same host, runner stays up):** `touch private/state/.lane-<role>-pause`.
  The runner idles in cheap no-op iterations ("paused … sleeping"), zero claude spawns, zero
  DB writes. Resume: delete the sentinel (takes effect after the current sleep, ≤ the lane's
  interval; for instant effect restart that lane). NOTE for the U7 watchdog: paused ≠ dead.
- **Pause everything / rollback the migration:** `tools/lanes-tmux.sh stop` (VPS) or close the
  herdr tabs (laptop). Leases release on TERM; the legacy tick heartbeat (tools/loop.md) is
  untouched until U9 and keeps the company running.

## systemd --user alternative (documented, NOT enabled — don't run two supervisors)

Probed on the VPS 2026-07-16: `systemctl --user` works without sudo and `loginctl show-user j
-p Linger` → `Linger=yes`, so user units WOULD survive logout and start at boot — no root
needed. System-level units are out (sudo denied to the loop; an owner could install them, but
there's no need given lingering works). We chose tmux+cron as the single supervisor; if you
ever switch, REMOVE the @reboot crontab line first. Unit template (`~/.config/systemd/user/lane@.service`):

```ini
[Unit]
Description=autocomp role lane %i
After=network-online.target

[Service]
WorkingDirectory=/home/j/autocomp
ExecStart=/home/j/autocomp/tools/role-loop.sh %i
Restart=on-failure
RestartSec=300
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=default.target
```

```
systemctl --user daemon-reload
systemctl --user enable --now lane@ceo lane@cto lane@qa lane@gtm
systemctl --user stop 'lane@*'        # TERM → leases release
```

Honest caveat: role-loop exits 1 on a foreign lease, so `Restart=on-failure` would re-hit a
leased lane every `RestartSec` — each attempt fires the lease-conflict ntfy. Keep RestartSec
generous (300s), or prefer the tmux path, where a refused lane just sits dead-and-visible.
