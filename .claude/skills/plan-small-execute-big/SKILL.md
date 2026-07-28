---
name: plan-small-execute-big
description: Use when a task cleanly splits into a handful of independent pieces that each need genuine reasoning — N hard subproblems, per-module deep refactors, a multi-part proof/analysis, independent deep-dives that merge at the end — its decomposition is obvious but every leaf is hard. A CHEAP planner (Fable) just splits; HEAVYWEIGHT executor subagents (Opus/Sonnet) each solve one piece deeply in parallel; a strong model synthesizes. Self-invoke autonomously when work has this shape — no user phrase required, safe inside an unattended tick or role lane. Also triggers on "plan small execute big", "cheap orchestrator strong workers", "fable coordinates opus/sonnet subagents". Mirror: plan-big-execute-small.
---

# plan-small-execute-big

The inverse of plan-big-execute-small. Here the **decomposition is the easy part** and the **leaves are
hard**, so a cheap/fast model does the coordination glue and heavyweight models spend the tokens where
the reasoning actually is. You avoid paying frontier rates for the coordination overhead while still
getting frontier reasoning on each deep subproblem — and the pieces run in parallel.

**Use it when** a task cleanly splits into a handful of independent pieces that each need genuine
reasoning (N hard questions, per-module deep refactors, a multi-part proof, independent deep-dives that
merge at the end). **Don't** use it when the work is mostly mechanical reading/lookups — that's the
mirror skill, `plan-big-execute-small`, and paying Opus for grunt work is the exact waste this avoids.

## The three roles
- **Planner** (cheap tier — default **Fable**, low effort): splits the task into a small set of
  independent, self-contained deep-work assignments and tags each `easy`/`hard`. Solves nothing.
- **Executors** (worker tier — default **Opus** for `hard`, **Sonnet** for `easy`): each gets ONE
  assignment + shared context and solves it with full rigor, in parallel with the others.
- **Synthesizer** (default = the hard-executor tier, since merging deep results is itself hard):
  reconciles the independently-solved pieces into the final deliverable.

## How to run it

1. **Frame the task and shared context.** One big task string plus the background every executor needs.
   Pieces must be answerable independently — if piece B needs piece A's output, that's a pipeline, not
   this pattern.
2. **Pick the model matrix** (defaults are the canonical combo). Presets:

   | Preset | planner | executor.easy | executor.hard | synthesizer | when |
   |---|---|---|---|---|---|
   | **default** | `fable` | `sonnet` | `opus` | `opus` | mixed deep pieces |
   | **all-opus-leaves** | `fable` | `opus` | `opus` | `opus` | every leaf is genuinely hard |
   | **sonnet-planner** | `sonnet` | `fable` | `opus` | `opus` | want a slightly stronger coordinator |

3. **Dispatch via the Workflow tool** — the skill ships a ready engine; pass the task + matrix as `args`:

   ```
   Workflow({
     scriptPath: ".claude/skills/plan-small-execute-big/scripts/engine.mjs",
     args: {
       task: "<the one big task>",
       context: "<background every executor needs>",   // optional
       planner: "fable",                                 // optional, default fable
       executor: { easy: "sonnet", hard: "opus" },       // optional, defaults shown
       synthesizer: "opus",                              // optional, default = executor.hard
       maxBriefs: 8                                       // optional
     }
   })
   ```

   The engine runs **Plan (cheap) → Execute (heavy, parallel) → Synthesize (strong)** and returns
   `{ approach, briefsPlanned, briefsCompleted, failed[], answer }`. Watch live with `/workflows`.

4. **Report honestly.** Give the user `answer`, and state `briefsCompleted/briefsPlanned` plus any
   `failed` labels — a dropped or unconvincing piece is a result, never hidden (CLAUDE.md: no invented
   results). Note the tier split so it's clear where the tokens went ("3 pieces on Opus, 1 on Sonnet,
   planner Fable").

### Lightweight fallback (no Workflow)
For a small split (≤4 pieces), do it inline: sketch the split yourself, then issue the deep assignments
as parallel `Agent` calls in one message with `model` per the matrix (`Agent({
subagent_type:"general-purpose", model:"opus", prompt:"<assignment + shared context>" })`), collect the
returns, and synthesize with a strong pass. Same three roles, no harness.

## Unattended / autonomous use (autocomp loop)
Safe to **self-invoke inside a tick or role lane** — no human prompt and no approval gate. Heavyweight
subagents are a real token spend (not a safety gate), so apply the Hundred-Dollar Test (CLAUDE.md
#6/#17): reach for it only when parallel deep work genuinely beats one sequential frontier pass.
- **Workflow opt-in:** invoking this skill **is** the opt-in to the Workflow tool — the owner set these
  skills up to be used autonomously, which is the standing authorization. Call the engine directly.
- **If the Workflow tool isn't present** (some headless `claude -p` runs), use the parallel-`Agent`
  fallback below, batching assignments when there are many. Never skip the work or fake a result.

## Notes & guardrails
- **This is the right pattern only when the leaves are hard.** If the executors could be Fable, you want
  `plan-big-execute-small` instead — running Opus workers on shallow briefs burns budget for nothing.
- **Independence is the contract.** Each assignment must be solvable seeing only itself + shared context.
  Genuine dependencies belong in the synthesis step or a staged pipeline, not smuggled between briefs.
- **Cheap planner, so keep its job easy.** If the split itself needs deep reasoning, bump `planner` to
  `sonnet`/`opus` (the `sonnet-planner` preset) — but then reconsider whether this is really the mirror
  skill's territory.
- **Subagents spend tokens** — heavyweight ones especially. Not a safety gate, but a real budget spend:
  reach for it when parallel deep work genuinely beats one sequential frontier pass.
- Change defaults by editing the top of `scripts/engine.mjs`, or just pass different `args`.
