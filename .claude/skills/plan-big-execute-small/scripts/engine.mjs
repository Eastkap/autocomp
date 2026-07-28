// plan-big-execute-small engine — a frontier PLANNER decomposes + synthesizes;
// cheap EXECUTORS do the token-heavy work in parallel. Faithful to Anthropic's
// CMA_plan_big_execute_small cookbook, implemented on the Workflow harness so each
// leg bills at its own model tier.
//
// Invoke via:  Workflow({ scriptPath: "<this file>", args: { ... } })
// args (all optional except task):
//   task     : string  — the big task to plan+execute (REQUIRED)
//   planner  : "opus"|"sonnet"|"fable"|"haiku"   (default "opus")  — judgment tier
//   executor : { easy, hard }  model per brief tier (default {easy:"fable", hard:"sonnet"})
//   plannerEffort : "low".."max" (default "high")
//   context  : string  — shared background handed to every executor (optional)
//   maxBriefs: number  — cap the fan-out (default 12)

export const meta = {
  name: 'plan-big-execute-small',
  description: 'Frontier planner decomposes a task into independent sub-briefs; cheap executors run them in parallel; the planner synthesizes the final answer.',
  phases: [
    { title: 'Plan', detail: 'planner decomposes into independent, tiered sub-briefs' },
    { title: 'Execute', detail: 'cheap executors run each brief in parallel at its tier' },
    { title: 'Synthesize', detail: 'planner aggregates the worker reports into the answer' },
  ],
}

const TASK = args?.task
if (!TASK) throw new Error('plan-big-execute-small: args.task is required')
const PLANNER = args?.planner ?? 'opus'
const EXEC = { easy: 'fable', hard: 'sonnet', ...(args?.executor ?? {}) }
const PLANNER_EFFORT = args?.plannerEffort ?? 'high'
const CONTEXT = args?.context ?? ''
const MAX_BRIEFS = args?.maxBriefs ?? 12

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    approach: { type: 'string', description: 'one-line decomposition rationale' },
    briefs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'short kebab-case id for this piece' },
          tier: { type: 'string', enum: ['easy', 'hard'], description: 'easy=mechanical/lookup; hard=needs real reasoning' },
          brief: { type: 'string', description: 'a fully self-contained instruction — the executor sees ONLY this + shared context' },
        },
        required: ['label', 'tier', 'brief'],
      },
    },
  },
  required: ['approach', 'briefs'],
}

phase('Plan')
const plan = await agent(
  [
    'You are the PLANNER in a plan-big-execute-small team. Do NOT solve the task yourself.',
    'Decompose it into INDEPENDENT, parallelizable sub-briefs — each one must stand alone',
    '(an executor sees only its own brief + the shared context, never the others or the original task).',
    'Prefer many small mechanical briefs over a few big ones — that is where the cost win is.',
    'Tag each brief: "easy" for lookups/reading/mechanical work, "hard" only when it genuinely needs deep reasoning.',
    `Emit at most ${MAX_BRIEFS} briefs. Keep judgment for the synthesis step, not the briefs.`,
    CONTEXT ? `\nSHARED CONTEXT:\n${CONTEXT}` : '',
    `\nTASK:\n${TASK}`,
  ].join('\n'),
  { model: PLANNER, effort: PLANNER_EFFORT, schema: PLAN_SCHEMA, label: 'plan', phase: 'Plan' },
)

log(`planned ${plan.briefs.length} briefs — ${plan.approach}`)

phase('Execute')
const reports = await parallel(
  plan.briefs.slice(0, MAX_BRIEFS).map((b) => () =>
    agent(
      [
        'You are an EXECUTOR. Complete EXACTLY the sub-brief below and nothing more.',
        'Be thorough on the mechanical work; return only distilled findings + the evidence',
        '(quotes, file:line, URLs, numbers) — never dump raw source back. End with a tight result.',
        CONTEXT ? `\nSHARED CONTEXT:\n${CONTEXT}` : '',
        `\nSUB-BRIEF (${b.label}):\n${b.brief}`,
      ].join('\n'),
      {
        model: EXEC[b.tier] ?? EXEC.easy,
        effort: b.tier === 'hard' ? 'high' : 'low',
        label: `exec:${b.label}`,
        phase: 'Execute',
      },
    ).then((r) => ({ label: b.label, tier: b.tier, report: r })),
  ),
)

const done = reports.filter(Boolean)
log(`executed ${done.length}/${plan.briefs.length} briefs`)

phase('Synthesize')
const answer = await agent(
  [
    'You are the PLANNER again. Synthesize the FINAL answer to the original task from the worker reports.',
    'Reconcile conflicts, note any brief that failed or came back thin, and do the cross-cutting judgment',
    'the executors could not. Return the finished deliverable, not a description of the process.',
    `\nORIGINAL TASK:\n${TASK}`,
    `\nWORKER REPORTS:\n${JSON.stringify(done, null, 2)}`,
  ].join('\n'),
  { model: PLANNER, effort: PLANNER_EFFORT, label: 'synthesize', phase: 'Synthesize' },
)

return {
  approach: plan.approach,
  briefsPlanned: plan.briefs.length,
  briefsCompleted: done.length,
  failed: plan.briefs.map((b) => b.label).filter((l) => !done.some((d) => d.label === l)),
  answer,
}
