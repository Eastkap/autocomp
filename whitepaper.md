# Open-Source Equivalents to Pancake and Nanocorp

## TL;DR
- **Pancake (getpancake.ai) is a hosted "OpenClaw-in-Slack" autonomous-agent platform** — its own Product Hunt tagline is literally "Pancake: OpenClaw in Slack that makes your company autonomous" — so the closest open-source equivalents are self-hostable autonomous-agent operating systems: Kortix/Suna (Apache-2.0, best production match), OpenClaw (MIT, the literal thing it wraps), and Hermes Agent (MIT).
- **Nanocorp (nanocorp.so) is a YC-backed "AI app/website builder fused with an autonomous AI company"** — and no single OSS project replicates its full build→deploy→Stripe→ads→outreach loop. The closest answer is a combination: Kortix/Suna for the "AI company/workforce" layer + an OSS app builder (bolt.diy or Dyad) for the "prompt-to-deployed-app" layer; the commerce/ads/outreach business layer is a genuine open-source gap you'd build yourself.
- **The shared pattern ("same model as webclaw/superlog") is real and confirmed:** both are managed SaaS wrappers around an open-source-style autonomous multi-agent capability. You pay them for hosting, sandboxing, secrets vaulting, approval gating, and integrations you can otherwise self-host. For a production AI engineer, **Kortix/Suna is the single best self-hostable answer to both products' core "AI workforce" function.**

## Key Findings

### What each product actually is
- **Pancake** — A hosted "superagent" that connects to your company tools and spins up *squads* of autonomous agents (outreach, AI SEO, GitHub triage, Google/Meta ads, Reddit monitoring, PostHog analytics), living in Slack and acting 24/7. It leans heavily on security: per-agent sandboxes ("nothing leaves your pod"), least-privilege tool access, an encrypted secrets vault referenced by path (never by value), human approval gates for destructive/expensive actions, and an immutable audit log with replay/rollback. It is SOC 2 compliant, priced at **$49/month flat for an always-on agent (Slack, iMessage, phone, email, browser, model-agnostic harness) plus token packs — "No tiers, no tricks"** — and its Product Hunt badge reads "OpenClaw in Slack that makes your company autonomous." The founder's own framing: "while building our previous company, we were such heavy OpenClaw users that 50% of our company was running on autopilot, generating ~10 demos per week." Category: **managed multi-agent "AI workforce" / autonomous agent OS.**
- **Nanocorp** — A YC-backed product from Phospho Inc. (founder Pierre-Louis Biojout, CTO @ phospho, École Polytechnique X2019). Its YC profile: "NanoCorp is the platform to create and run autonomous companies. In just one prompt, get an autonomous company run by an agent that maximizes revenues while trying to avoid bankruptcy with no human intervention." From one prompt it builds the product and a live website on a custom domain (Vercel), wires up Stripe payments, runs Meta ads (Facebook/Instagram), does cold-email prospecting, and reports to you through a "CEO" orchestrator agent. Reported early traction includes "2,000 companies created on NanoCorp in 3 weeks" and a claim of "$250K ARR in 19 days." Category: **managed AI app/website builder fused with an autonomous multi-agent business-operations layer.** Caveat: independent reviews indicate the "fully autonomous" claims are partly aspirational — most steps still require manual approval, and some advertised ad automation (e.g., Google Search Ads) was not yet shipped as of mid-2026.

### The shared pattern
Both products are **hosted commercial wrappers around the "autonomous agent" capability stack** that is otherwise available open source. The underlying capability — an LLM-driven agent loop with tool use, persistent memory, a sandboxed runtime, multi-channel/Slack delivery, scheduling, and approval/audit guardrails — is exactly what the OSS projects below provide. What you pay Pancake/Nanocorp for is managed hosting, security hardening, secrets management, prebuilt integrations, and (for Nanocorp) the commerce/ads/outreach business layer. This is the same "managed wrapper over self-hostable OSS" model as webclaw/superlog.

---

## Details — Open-Source Alternatives

### Group A — Alternatives to PANCAKE (autonomous multi-agent "AI workforce" / agent OS)
Ranked by closeness of match × project health for a production AI engineer.

**1. Kortix / Suna — best overall production match**
- GitHub: `github.com/kortix-ai/suna` · License: **Apache 2.0** (clean OSI) · **19,845 stars (3,422 forks; org page updated Jun 15, 2026)**, very actively maintained (daily commits; CLI, cloud + self-host).
- What it is: explicitly positioned as "The Company AI Command Center" / "The Autonomous Company Operating System." Python/FastAPI backend, Next.js frontend, Docker-isolated per-agent sandboxes (Daytona), Supabase data layer, LLM-agnostic via LiteLLM. Runs a *workforce* of specialist agents that browse, write/run code, manage files, deploy websites, call APIs, run on cron/webhooks, and produce real deliverables — not just chat.
- Match to Pancake: **Very high.** Mirrors Pancake's "squads of agents that work autonomously," BYO-models, self-host on your own infra/VPC/air-gapped, microVM isolation, members/groups/roles, encrypted secrets manager, full audit trail, and human approval gates on sensitive actions — nearly the same security posture Pancake advertises.
- Gaps/tradeoffs: heavier setup (14-step wizard; Supabase/Redis/Daytona dependencies). Slack delivery exists but is less polished than Pancake's Slack-first UX. You operate the security yourself.

**2. OpenClaw — the literal thing Pancake wraps**
- GitHub: `github.com/openclaw/openclaw` · License: **MIT** · **~376k stars (78.5k forks)** — one of the fastest-growing repos in GitHub history, very active under the OpenClaw Foundation.
- What it is: a local-first "personal AI assistant" Gateway (Node.js) that routes messages from Slack, WhatsApp, Telegram, Discord, Signal, iMessage and 20+ channels to an LLM agent that runs shell commands, browses, manages files/email/calendar, on a heartbeat scheduler. Markdown-file memory, portable SKILL.md skills, model-agnostic (Claude/GPT/Gemini/Ollama).
- Match to Pancake: **High on capability** — Pancake brands itself "OpenClaw in Slack." Same agentic loop, multi-channel delivery, scheduling, skills.
- Gaps/tradeoffs: **Security is the decisive issue.** It carries a documented history of serious flaws: **CVE-2026-25253 (CVSS 8.8, one-click RCE), patched in v2026.1.29 (Jan 30, 2026)**, followed by the even more severe **CVE-2026-32922 (CVSS 9.9, Mar 29, 2026 — described by ARMO as "the most severe vulnerability in OpenClaw's history")**. Censys tracked publicly exposed instances growing "from ~1,000 to over 21,000 between 25 and 31 January 2026." The "ClawHavoc" campaign found "341 malicious skills in ClawHub (12% of the registry)," with later scans reporting "over 800 malicious skills." Microsoft's security team stated it is "not appropriate to run it on a standard personal or corporate machine," and firms including SAP moved to block it. It ships with no RBAC/SSO/SOC 2 by default. Pancake's whole value-add is the sandbox/vault/approval layer OpenClaw lacks — so for production, harden it (see Archestra) or prefer Suna/Hermes.

**3. Hermes Agent — best for persistent memory + self-improving skills**
- GitHub: `github.com/NousResearch/hermes-agent` · License: **MIT** · **~195k stars (mid-2026; the fastest-growing agent framework of 2026)**, very active (390+ contributors), built by Nous Research.
- What it is: a self-hosted autonomous agent with a closed learning loop (auto-creates/refines skills from experience), three-layer persistent memory, cron scheduling, 18–20+ messaging platforms incl. Slack, six terminal backends (local/Docker/SSH/Daytona/Singularity/Modal), model-agnostic. Direct migration path from OpenClaw.
- Match to Pancake: **High.** Same always-on, multi-channel, scheduled autonomous-agent model, with a stronger security posture than OpenClaw (curated ~118-skill library vs. open marketplace) and compounding memory.
- Gaps/tradeoffs: self-learning/memory is opaque and disabled by default; positioned as a conversational/ops agent, not a coding tool; no native company-commerce layer.

**4. AutoGPT Platform — closest to Pancake's no-code agent *builder***
- GitHub: `github.com/Significant-Gravitas/AutoGPT` · License: **mixed — MIT for the classic agent, but the `autogpt_platform/` folder is Polyform Shield (NOT OSI open source)** · **~185k stars**, active.
- What it is: matured from the 2023 viral demo into a visual block-based agent builder + marketplace + Docker self-hosting; agents run on schedules/triggers with run-by-run dashboards.
- Match to Pancake: **Moderate-high** for the "build your own squad / agents that run autonomously on triggers" angle and the no-/low-code builder.
- Gaps/tradeoffs: **License is the catch** — commercial redistribution of the platform is restricted under Polyform Shield; verify compliance before building a company on it. Historically prone to runaway loops/cost; less messaging-first than Pancake.

**5. gptme — lightweight, scriptable persistent agent**
- GitHub: `github.com/gptme/gptme` · License: **MIT** · ~4.3k stars, very active; one of the earliest agent CLIs (2023).
- What it is: a terminal-native, provider-agnostic agent (shell, Python, browser, vision) that also runs as a persistent autonomous agent with git-backed memory (gptme-agent-template); MCP + ACP support; non-interactive/CI modes.
- Match to Pancake: **Moderate** — it's the engine, not the Slack-first product; ideal if you want to build your own Pancake-like layer with full control and minimal dependencies.
- Gaps/tradeoffs: no built-in Slack-squads UI, no managed security; you assemble the platform.

**Companion projects for the Pancake security model:**
- **Archestra** (`github.com/archestra-ai/archestra`, ~2.8k stars) — open-source "Enterprise AI platform with guardrails, MCP registry, gateway & orchestrator"; adds RBAC, LLM-proxy-level tool permissions, cost caps, sandboxing, and prompt-injection isolation. It supplies the governance layer that makes OpenClaw/Suna deployable like Pancake (its team publicly demoed exfiltrating an SSH key from an unprotected OpenClaw via a prompt-injection email in under five minutes).
- **Onyx** (`onyx.app`) — open-source governed enterprise AI platform (assistants, search, permission-aware data access, audit, self-host), positioned as the IT-sanctioned alternative to ungoverned agent tools.

### Group B — Alternatives to NANOCORP
Nanocorp = **(app/website builder) + (autonomous business-operations workforce)**. No single OSS project does the whole loop, so the answer is split.

**B1. The "autonomous company / workforce" layer**
- **Kortix / Suna** (`github.com/kortix-ai/suna`, Apache-2.0, **19,845 stars**) — **the closest single OSS analog to Nanocorp's positioning.** It is the only major OSS project framed as an autonomous *company/workforce* that combines build + deploy + 24/7 autonomous operation + an orchestrator-style agent, and it explicitly markets lead prospecting and outreach-email drafting plus website deployment. Best foundation for self-hosting Nanocorp's "AI company" model.

**B2. The "prompt → deployed app/website" layer**
- **bolt.diy** (`github.com/stackblitz-labs/bolt.diy`, **MIT**, ~19.5k stars, active) — prompt, run, edit, and deploy full-stack web apps using any LLM (19+ providers); deploys to Netlify/Vercel; Supabase integration. **Caveat:** relies on StackBlitz WebContainers, which require a **commercial license for production/for-profit use** (prototypes/POCs are fine).
- **Dyad** (`github.com/dyad-sh/dyad`, **Apache-2.0** outside the proprietary `src/pro` folder, **~16.8k stars, downloaded over 1 million times**, very active) — local-first, open-source v0/Lovable/Bolt alternative; runs on your machine, BYO API keys, builds full-stack apps with Auth/DB/server functions, Supabase + GitHub + Vercel integration. Best local-first, clean-license choice for the build/deploy half.
- (Also viable: **Pythagora/gpt-pilot** for in-IDE full-app generation; **Open-Lovable**, Apache-2.0, for prompt-to-React apps.)

**B3. The "AI software company" simulators (closest in *metaphor*, weakest in *function*)**
- **MetaGPT** (`github.com/FoundationAgents/MetaGPT`, **MIT**, **~68k stars (star-history: 67.9k, Global Rank #241)**, active) — multi-agent "First AI Software Company": one-line requirement → PRD, design, tasks, code via PM/architect/engineer roles ("Code = SOP(Team)").
- **ChatDev** (`github.com/OpenBMB/ChatDev`, Apache-2.0, active; v2.0 "DevAll" released Jan 2026) — a virtual software company (CEO/CTO/programmer agents); v2.0 is a zero-code multi-agent orchestration platform that even integrates *with* OpenClaw.
- Match: these mimic Nanocorp's "company of agents" framing but **only output code/docs** — no deploy, no Stripe, no ads, no outreach. Use them for the build-from-spec step, not as a Nanocorp replacement.

### The genuine open-source gap (important for the company-building goal)
No open-source project ships Nanocorp's **business-operations autonomy** as a turnkey feature: autonomous **Stripe product/pricing creation + live billing**, **Meta/Google ad-campaign creation and optimization**, automated **cold-email outreach**, and a **"CEO" orchestrator that emails you daily revenue/P&L reports**. Suna *could* be scripted toward parts of this via generic browser/API tools, and OpenClaw/Hermes have ads/outreach community skills, but the integrated commerce+ads+revenue loop is exactly the closed-source differentiator and currently has no clean OSS equivalent. If you want it, you build that layer on top of Suna (or OpenClaw+Archestra) — which is also where your moat would be.

---

## Recommendations

**Stage 1 — Pick your foundation (this week).**
- For a Pancake-style "AI workforce in Slack" with production-grade isolation: **start with Kortix/Suna (Apache-2.0).** It gives you the multi-agent runtime, sandboxing, secrets manager, RBAC, audit trail, and approval gates closest to Pancake without license risk.
- If you want the literal OpenClaw experience or its huge skill ecosystem: run **OpenClaw (MIT) only behind Archestra** (guardrails/RBAC/sandboxing) — never expose it raw. *Threshold to change this:* if a security review (SOC 2 / RBAC / no public-internet exposure / dependency CVE posture) cannot pass, do not ship OpenClaw to production.
- If persistent memory and self-improving skills matter more than ecosystem breadth: choose **Hermes Agent (MIT).**

**Stage 2 — Add Nanocorp's app-builder capability (if needed).**
- Use **Dyad** (local-first, clean Apache-2.0) for prompt-to-deployed apps, or **bolt.diy** for browser-based full-stack deploy — but only after confirming a WebContainers commercial license for for-profit use. *Threshold:* if you need to redistribute or run at scale commercially, prefer Dyad/Open-Lovable over bolt.diy to avoid WebContainers licensing.

**Stage 3 — Build the missing business-operations layer.**
- Treat Stripe/ads/outreach/CEO-reporting as *your* differentiator. Implement it as tools/skills on top of Suna (or OpenClaw+Archestra): a Stripe API tool, Meta/Google Ads API tools, an outreach/email tool, and a scheduled reporting agent. This is the gap no OSS fills — owning it is the moat.

**Avoid:** treating MetaGPT/ChatDev as production company-runners (they stop at code), and avoid AutoGPT's `autogpt_platform/` folder for commercial redistribution (Polyform Shield).

**Decision thresholds that would change the above:** if Kortix/Suna's license or governance changes (Apache-2.0 today — re-verify the LICENSE before commercial use), fall back to Hermes (MIT) + Archestra. If your priority shifts to pure coding automation rather than a "workforce," use **OpenHands** (All-Hands-AI/OpenHands, MIT core, ~65–74k stars, SWE-bench-validated, $18.8M funded) instead.

## Caveats
- **Star counts and licenses are mid-2026 snapshots** and shift constantly; re-verify the LICENSE file directly before commercial use — especially AutoGPT (Polyform Shield on `autogpt_platform/`), OpenHands-Cloud (Polyform Free Trial; core is MIT), Dyad (`src/pro` is proprietary), and bolt.diy (WebContainers commercial license for for-profit production).
- **OpenClaw's security record is serious and ongoing** (CVE-2026-25253 at CVSS 8.8 and CVE-2026-32922 at CVSS 9.9, 21,000+ exposed instances, 800+ malicious marketplace skills, corporate bans at Microsoft/SAP and others). Do not deploy it unhardened. Pancake's commercial value is precisely the sandbox/vault/approval layer it adds.
- **Both products' autonomy claims are partly forward-looking.** Nanocorp reviewers report most steps still need manual approval and some advertised ad automation was unshipped; treat "makes your company autonomous" and "found a company in one sentence" as marketing rather than literal current capability.
- **Source confidence varies.** Where live GitHub pages were fetched (Suna, MetaGPT, OpenClaw advisory) confidence is highest; AutoGPT, OpenHands, Hermes, Dyad, and bolt.diy counts come from GitHub sub-pages and reputable third-party trackers and are approximate.

---

## How autocomp relates to this whitepaper
`autocomp` is the **native Claude Code port** of the capability both products wrap. Rather than self-hosting Suna or hardening OpenClaw, it implements the autonomous-company loop directly from Claude Code primitives — `Agent` subagents (the "squad"), `/loop`+`ScheduleWakeup`/`/goal`/`CronCreate` (the heartbeat), file-based memory and an append-only `ledger.md` (the audit log), `AskUserQuestion` + `state/approvals.md` (the approval gates), and a gitignored `.env` referenced by name (the secrets vault). The commerce/ads/outreach business layer — the "genuine open-source gap" above — is exactly what `tools/stripe.md`, `tools/ads.md`, and `tools/outreach.md` own. See `README.md` and `CLAUDE.md`.
