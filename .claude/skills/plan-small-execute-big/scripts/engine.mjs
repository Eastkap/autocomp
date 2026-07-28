// plan-small-execute-big engine — a CHEAP planner does the (easy) coordination/glue;
// HEAVYWEIGHT executors do the hard leaf reasoning in parallel. The mirror of
// plan-big-execute-small: use when decomposition is trivial but each piece is deep.
// Built on the Workflow harness so each leg bills at its own model tier.
//
// Invoke via:  Workflow({ scriptPath: "<this file>", args: { ... } })
// args (all optional except task):
//   task     : string  — the big task to plan+execute (REQUIRED)
//   planner  : "fable"|"sonnet"|"haiku"|"opus"  (default "fable")  — cheap coordination tier
//   executor : { easy, hard }  model per brief tier (default {easy:"sonnet", hard:"opus"})
//   plannerEffort : "low".."max" (default "low")
//   context  : string  — shared background handed to every executor (optional)
//   maxBriefs: number  — cap the fan-out (default 8)
//   synthesizer : model for the final merge (default = the hard executor tier, since
//                 merging deep results is itself a hard-reasoning job)

export const meta = {
  name: 'plan-small-execute-big',
  description: 'A cheap planner splits a task into a few independent pieces; heavyweight executors each solve one deeply in parallel; a strong synthesizer merges them.',
  phases: [
    { title: 'Plan', detail: 'cheap planner splits the task into independent hard pieces' },
    { title: 'Execute', detail: 'heavyweight executors each solve one piece in parallel' },
    { title: 'Synthesize', detail: 'strong synthesizer merges the deep results' },
  ],
}

const TASK = args?.task
if (!TASK) throw new Error('plan-small-execute-big: args.task is required')
const PLANNER = args?.planner ?? 'fable'
const EXEC = { easy: 'sonnet', hard: 'opus', ...(args?.executor ?? {}) }
const PLANNER_EFFORT = args?.plannerEffort ?? 'low'
const CONTEXT = args?.context ?? ''
const MAX_BRIEFS = args?.maxBriefs ?? 8
const SYNTH = args?.synthesizer ?? EXEC.hard

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    approach: { type: 'string', description: 'one-line split rationale' },
    briefs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'short kebab-case id' },
          tier: { type: 'string', enum: ['easy', 'hard'], description: 'hard=needs frontier reasoning (default); easy=a strong-but-cheaper model suffices' },
          brief: { type: 'string', description: 'a self-contained deep-work assignment — the executor sees ONLY this + shared context' },
        },
        required: ['label', 'tier', 'brief'],
      },
    },
  },
  required: ['approach', 'briefs'],
}

// Cheap planner: keep the prompt tight — coordination here is the EASY part.
phase('Plan')
const plan = await agent(
  [
    'You are the PLANNER. The split is the easy part; the hard reasoning happens downstream, so do NOT solve anything.',
    'Cut the task into a SMALL number of INDEPENDENT pieces, each of which needs real, deep reasoning to solve.',
    'Each brief must stand alone (its executor sees only that brief + the shared context).',
    'Tag "hard" (the default) when a piece needs frontier reasoning; "easy" only if a cheaper strong model clearly suffices.',
    `Emit at most ${MAX_BRIEFS} briefs — fewer, deeper pieces beat many shallow ones here.`,
    CONTEXT ? `\nSHARED CONTEXT:\n${CONTEXT}` : '',
    `\nTASK:\n${TASK}`,
  ].join('\n'),
  { model: PLANNER, effort: PLANNER_EFFORT, schema: PLAN_SCHEMA, label: 'plan', phase: 'Plan' },
)

log(`planned ${plan.briefs.length} deep pieces — ${plan.approach}`)

phase('Execute')
const reports = await parallel(
  plan.briefs.slice(0, MAX_BRIEFS).map((b) => () =>
    agent(
      [
        'You are a HEAVYWEIGHT EXECUTOR. Solve EXACTLY the assignment below with full rigor —',
        'this piece was routed to you because it needs deep reasoning. Show the reasoning that matters,',
        'then return a decisive result with its evidence. Do not restate the assignment.',
        CONTEXT ? `\nSHARED CONTEXT:\n${CONTEXT}` : '',
        `\nASSIGNMENT (${b.label}):\n${b.brief}`,
      ].join('\n'),
      {
        model: EXEC[b.tier] ?? EXEC.hard,
        effort: b.tier === 'hard' ? 'high' : 'medium',
        label: `exec:${b.label}`,
        phase: 'Execute',
      },
    ).then((r) => ({ label: b.label, tier: b.tier, report: r })),
  ),
)

const done = reports.filter(Boolean)
log(`executed ${done.length}/${plan.briefs.length} pieces`)

// Synthesis of deep results is itself hard reasoning → strong model by default.
phase('Synthesize')
const answer = await agent(
  [
    'You are the SYNTHESIZER. Merge these independently-solved deep pieces into one coherent final deliverable.',
    'Resolve contradictions between pieces on the merits, surface any piece that failed or is unconvincing,',
    'and do the cross-piece reasoning none of the executors could see. Return the finished result.',
    `\nORIGINAL TASK:\n${TASK}`,
    `\nEXECUTOR RESULTS:\n${JSON.stringify(done, null, 2)}`,
  ].join('\n'),
  { model: SYNTH, effort: 'high', label: 'synthesize', phase: 'Synthesize' },
)

return {
  approach: plan.approach,
  briefsPlanned: plan.briefs.length,
  briefsCompleted: done.length,
  failed: plan.briefs.map((b) => b.label).filter((l) => !done.some((d) => d.label === l)),
  answer,
}
