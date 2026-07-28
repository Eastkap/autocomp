---
name: plan-big-execute-small
description: Use when a task is a little judgment plus a lot of independent mechanical reading/doing — research sweeps, codebase/security audits, doc or log review, bulk extraction, checking many items — and fanning it out cheaply beats one sequential pass. A frontier PLANNER (Opus/Sonnet) decomposes and synthesizes; cheap EXECUTOR subagents (Fable/Sonnet) do the token-heavy middle in parallel (~2.5x cheaper, ~3x faster). Self-invoke autonomously the moment work has this shape — no user phrase required, safe inside an unattended tick or role lane. Also triggers on "plan big execute small", "orchestrator plans cheap workers execute", "fan this out cheaply". Mirror: plan-small-execute-big.
---

# plan-big-execute-small

A capable model spends its tokens on the two things that need judgment — **decomposition** and
**synthesis** — and cheap/fast models do the large, mechanical middle in parallel. From Anthropic's
`CMA_plan_big_execute_small` cookbook: most agent work is "a small amount of planning and a large
amount of mechanical reading and doing," so routing the token-heavy leg through a cheap tier measured
~2.5x cheaper and ~3x faster with no loss of rigor.

**Use it when** the task splits into many independent, self-contained pieces that are individually
shallow (lookups, reading a page/file, extracting, checking) but collectively large. **Don't** use it
when the pieces are deeply interdependent or each leaf needs frontier reasoning — that's the mirror
skill, `plan-small-execute-big`.

## The three roles
- **Planner** (orchestrator tier — default **Opus**): decomposes the task into independent sub-briefs,
  tags each `easy`/`hard`, and at the end synthesizes the final deliverable. Never does the grunt work.
- **Executors** (worker tier — default **Fable** for `easy`, **Sonnet** for `hard`): each gets ONE
  self-contained brief + shared context, does the mechanical work, returns distilled findings + evidence.
- The Workflow harness is the deterministic glue (fan-out, parallelism, per-agent model billing).

## How to run it

1. **Frame the task and shared context.** Write the one big task string and any background every
   executor needs (repo path, the question, the target list). Keep briefs able to stand alone.
2. **Pick the model matrix** (defaults are the cookbook combo). Presets:

   | Preset | planner | executor.easy | executor.hard | when |
   |---|---|---|---|---|
   | **cookbook (default)** | `opus` | `fable` | `sonnet` | most read-heavy work |
   | **max-cheap** | `opus` | `fable` | `fable` | pure mechanical fan-out, no hard leaves |
   | **sonnet-orchestrator** | `sonnet` | `fable` | `opus` | cheaper planner, a few hard leaves need Opus |

3. **Dispatch via the Workflow tool** — the skill ships a ready engine; pass the task + matrix as `args`:

   ```
   Workflow({
     scriptPath: ".claude/skills/plan-big-execute-small/scripts/engine.mjs",
     args: {
       task: "<the one big task>",
       context: "<background every executor needs>",   // optional
       planner: "opus",                                  // optional, default opus
       executor: { easy: "fable", hard: "sonnet" },      // optional, defaults shown
       maxBriefs: 12                                      // optional
     }
   })
   ```

   The engine runs **Plan → Execute (parallel) → Synthesize** and returns
   `{ approach, briefsPlanned, briefsCompleted, failed[], answer }`. Watch live with `/workflows`.

4. **Report honestly.** Give the user `answer`, and state `briefsCompleted/briefsPlanned` plus any
   `failed` labels — a thin or dropped brief is a result, never hidden (CLAUDE.md: no invented results).
   Note the tier split so the cost win is visible ("11 briefs: 9 on Fable, 2 on Sonnet, planner Opus").

### Lightweight fallback (no Workflow)
For a small fan-out (≤4 pieces) or when Workflow isn't warranted, do it inline: think through the
decomposition yourself (you are the planner), then issue the executor briefs as parallel `Agent` calls
in a single message with `model` set per the matrix (`Agent({ subagent_type:"general-purpose",
model:"fable", prompt:"<brief + shared context>" })`), collect the returns, and synthesize yourself.
Same three roles, no harness.

## Unattended / autonomous use (autocomp loop)
Safe to **self-invoke inside a tick or role lane** — no human prompt and no approval gate. Running
subagents is a token spend, not a safety-gated action, so the only test is the Hundred-Dollar Test
(CLAUDE.md #6/#17): reach for it when the fan-out genuinely pays for the coordination overhead.
- **Workflow opt-in:** invoking this skill **is** the opt-in to the Workflow tool — the owner set these
  skills up to be used autonomously, which is the standing authorization. Call the engine directly.
- **If the Workflow tool isn't present** (some headless `claude -p` runs), use the parallel-`Agent`
  fallback below, batching briefs in groups when there are many. Never skip the work or fake a result.

## Notes & guardrails
- **Independence is the contract.** Each brief must be answerable seeing ONLY itself + shared context.
  If a brief needs another brief's output, it's a *pipeline*, not a fan-out — split it into stages or
  fold the dependency into the planner's synthesis instead.
- **Tier honestly.** Marking everything `hard` erases the cost win; marking a real reasoning task `easy`
  yields slop. The planner's job is that call.
- **This runs subagents, which spend tokens.** It's not a safety-gated action, but it is a spend of the
  token budget — reach for it when the fan-out genuinely pays for the coordination overhead, not for a
  task one agent handles in one pass.
- Change the defaults by editing the top of `scripts/engine.mjs`, or just pass different `args`.
