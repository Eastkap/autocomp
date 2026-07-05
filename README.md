# autocomp

An **autonomous company** that runs as a tick loop inside Claude Code — no OpenClaw, no
Hermes, no Suna to self-host. The "AI workforce" is a thin layer of **role prompts + tool
playbooks + a heartbeat**, built entirely from Claude Code primitives:

| Capability (Pancake / Nanocorp wrap this) | autocomp uses |
|---|---|
| The agent "squad" | `Agent` subagents driven by `roles/*.md` |
| The heartbeat / always-on loop | `/loop`+`ScheduleWakeup`, `/goal`, or `CronCreate` |
| Memory | `private/memory/` files |
| Immutable audit log + replay | append-only `private/state/ledger.md` (git-tracked) |
| Approval gates | `private/state/approvals.md` + `AskUserQuestion` |
| Secrets vault (path, not value) | gitignored `.env`, referenced by name |
| Commerce / ads / outreach (the OSS gap) | `tools/stripe.md`, `tools/ads.md`, `tools/outreach.md` |

See `whitepaper.md` for the full Pancake/Nanocorp landscape and why this is the native port,
and `inspiration.md` for the tooling stack + principle sources.

## How it works
Each **tick** (one heartbeat): load state → CEO plans the highest-leverage moves → dispatch
role subagents → **gate** any money/send/destructive action for human approval → record to
the append-only ledger → report → reschedule. One tick = one heartbeat.

```
CLAUDE.md          principles + hard safety rules (read this)
roles/             CEO, builder, marketer, sales, analyst, cfo  (the org chart)
tools/             web, deploy, stripe, ads, outreach           (how roles act safely)
kanban/            optional shared task board (Supabase + static page)
.claude/           the autocomp-tick skill + /autocomp command
private.example/   the scaffold for a venture — copy it to private/ to start
private/           YOUR live venture (gitignored, never committed):
  charter.md         the company definition (the "one prompt")
  state/             ledger (audit) · pnl · backlog · kpis · approvals
  memory/            durable learnings that compound across ticks
  site/              the product's landing page
```
The framework (everything but `private/`) is the open-source part and is committed;
`private/` is your specific company's data and stays local.

## Quick start
1. `cp -r private.example private`, then edit `private/charter.md` to your venture.
2. (Optional) `cp .env.example .env` and fill any keys you have. Missing keys just turn the
   dependent step into a gated/manual action — nothing breaks.
3. Run the loop:
   - `/autocomp start` — run tick 1 and schedule the heartbeat.
   - `/autocomp goal` — run until the charter's "Definition of success" holds (`/goal`).
   - `/autocomp resume` / `/autocomp stop`.
   - Or invoke the `autocomp-tick` skill directly for a single tick.

## Loop drivers (pick one)
- **`ScheduleWakeup` / `/loop`** — interval heartbeat. Default; good for steady, attended runs.
- **`/goal`** — run until a verifiable end state (e.g. "first paying customer"). The Karpathy
  "give it success criteria and watch it go" pattern. (`code.claude.com/docs/en/goal`)
- **`CronCreate`** — unattended daily cadence. (`code.claude.com/docs/en/scheduled-tasks`)

## Safety (non-negotiable — see `CLAUDE.md`)
- Money, outbound sends, and destructive actions **always** pause for human approval.
- Secrets live in `.env` (gitignored), referenced by name — never inlined or committed.
- The ledger is append-only; metrics are measured, never invented.

## Status & boundaries (honest)
Stage-1 MVP: the loop, roles, gates, ledger, and approval flow are real and runnable. Web
research (`tools/web.md`) and deploy-verify are live. Stripe/ads/outreach are real playbooks
that execute once their keys exist and the human approves — until then they surface as
gated/manual steps. No fake autonomy.

## Live ventures (proof it runs)
The loop runs 24/7 on a VPS and operates real ventures end to end:

- **[Weekly Brief](https://brief.limed.tech)** — turns a newsletter firehose into one
  AI-ranked weekly brief in Readwise Reader, Matter, or Kindle. Ideated, built, deployed,
  and marketed tick by tick by the loop.
- **[autocomp](https://autocomp.limed.tech)** — the framework's own site, including a public
  [live activity feed](https://autocomp.limed.tech/live) streaming real ledger events as
  they happen.
