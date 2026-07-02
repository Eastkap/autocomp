# Inspiration & Sourcing Map

The repos/articles `autocomp` draws from. Group A is the **tooling stack** the `tools/`
playbooks integrate against. Group B is the **principle/method** source for `CLAUDE.md`.
Notes are the user's own framing, lightly edited.

---

## A. GTM tooling stack (integration surface for `tools/`)

### 1. PostHog — `github.com/PostHog/posthog`
Tracks UTMs, visits, product events, and campaign attribution. *Did anything happen after
the click?* → feeds `roles/analyst.md` (KPIs, attribution).

### 2. Apify CLI — `github.com/apify/apify-cli`
The one to reach for when you need public data fast: competitor followers, Reddit threads,
Meta ads, public directories, Y Combinator lists. Turn public data into tables before a
campaign starts. The CLI matters because the agent can run it from the terminal, fetch the
dataset, and keep working. → `tools/web.md`.

### 3. Playwright — `github.com/microsoft/playwright`
The browser layer (headless). Scraping, screenshots, QA checks, form tests, app
verification. If an agent needs to read a real page or prove something worked, Playwright is
usually the way in — checking pages, verifying dashboards, grabbing screenshots, confirming
the API result actually looks right on screen. → `tools/web.md`, `tools/deploy.md` verification.

### 4. Supabase — `github.com/supabase/supabase`
Cloud SQL. When a GTM system needs to live beyond the Mac: campaign state, lead tables,
product data, dashboards, auth, cloud Postgres. Local-first works until another person or
process needs the data too.

### 5. better-sqlite3 — `github.com/WiseLibs/better-sqlite3`
Local SQL. Fast, boring, inspectable. Local campaign state, intel databases, enrichment
caches — anything an agent should read without asking a SaaS dashboard for permission.
**The pattern: cloud SQL + local SQL.** Supabase when it needs to be shared; SQLite when you
need speed, git, and iteration. In autocomp, state graduates `markdown → SQLite → Supabase`.

### 6. HubSpot CLI — `github.com/HubSpot/hubspot-cli`
The CRM layer. Private app token, scoped permissions, create the properties you need, write
enrichment back to the exact fields the team actually uses. Use HubSpot as the CRM; keep the
operating system in the repo. → `tools/outreach.md`, `roles/sales.md`.

### 7. Superpowers + Get Shit Done — `github.com/obra/superpowers` · `github.com/gsd-build/get-shit-done`
Two versions of agent orchestration. Superpowers is skill/methodology driven; GSD is
spec/context/planning driven. Test both, keep only the parts that produce shipped work.

### 8. Obsidian Nexus — `github.com/ProfSynapse/nexus`
Connects Obsidian to agents so notes become working context. Good if you care about local
notes, backlinks, graph views, and long-term thinking.

### 9. d3-force — `github.com/d3/d3-force`
For when the data is actually a graph: competitors, followers, signals, accounts, posts,
comments, tools, people. Surfaces clusters and relationships a normal table hides. → dashboards.

### 10. xyflow — `github.com/xyflow/xyflow`
Maps nodes, edges, decisions, handoffs. Great for connector maps, CRM flows, campaign
systems, agent workflows, onboarding boards — any GTM system where a paragraph would make
the thing harder to understand. → dashboards.

### 11. Recursive Drift — `github.com/shawnla90/recursive-drift`
(User's own.) How to structure recurring work across content, product, outbound, CRM,
agents, handoffs, and long-running builds. Gives the work a shape the agent can keep
returning to. → informs the staged `state/backlog.md`.

### 12. Context Handoff Engine — `github.com/shawnla90/context-handoff-engine`
(User's own.) Keeps context alive for Claude Code across sessions, terminals, and agents.
The real constraint after a while is whether the agent can find where the work actually
lives. → informs `memory/` + handoff discipline.

### 13. Website With Soul — `github.com/shawnla90/website-with-soul`
(User's own.) Memory, voice, personality, and a real system behind the site. For a founder
site / personal OS / content hub / AI-native website that needs to feel like a person lives
inside the work.

### Special mention: GTM Coding Agents — `github.com/shawnla90/gtm-coding-agent`
(User's own.) The main one — up to Chapter 17 and growing. Next up: programmatic emails
(still being tested before the pattern is published).

### upload-post — `app.upload-post.com/manage-users`
Social publishing surface (multi-platform post upload). → `tools/outreach.md` / marketer
publishing step.

---

## B. Principles & method inspiration (sources for `CLAUDE.md`)

### Karpathy skills — `github.com/multica-ai/andrej-karpathy-skills` (PRIMARY)
Four skills, the backbone of autocomp's operating principles:
1. **Think Before Coding** — "Don't assume. Don't hide confusion. Surface tradeoffs."
2. **Simplicity First** — "Minimum code that solves the problem. Nothing speculative."
3. **Surgical Changes** — "Touch only what you must. Clean up only your own mess."
4. **Goal-Driven Execution** — turn tasks into verifiable success criteria + testing loops.
> "LLMs are exceptionally good at looping until they meet specific goals… Don't tell it what
> to do, give it success criteria and watch it go." — Karpathy (via this repo)

### Other method sources
- fable-mode — `github.com/mrtooher/fable-mode`
- wondelai skills — `github.com/wondelai/skills`
- compound-engineering plugin — `github.com/everyinc/compound-engineering-plugin` (compounding context / learnings)
- vibecoded-design-tells — `github.com/JCarterJohnson/vibecoded-design-tells` (anti-AI-slop checklist)

### taaft decision/communication frameworks (Notion — titles as named heuristics)
- **Cut or Commit** — kill it or ship it; don't half-do.
- **The Someday Shelf** — name where deferred ideas go so they don't haunt the backlog.
- **The Hundred-Dollar Test** — is this the highest-leverage $100/hour right now?
- **The Apology That Lands** — honest customer/founder comms when something breaks.
- **The Cold Open** — outreach openers that don't read as templated.
> These pages render client-side; captured here by title. To bake full content in, paste the
> page text or fetch via the chrome MCP.

### Claude Code mechanics (the heartbeat)
- Scheduled tasks — `code.claude.com/docs/en/scheduled-tasks` (`/loop`, cron)
- Dynamic workflows — `claude.com/blog/introducing-dynamic-workflows-in-claude-code`
- `/goal` — `code.claude.com/docs/en/goal` (run until a verifiable completion condition holds)
