---
name: next-move
description: Decide the single highest-leverage next thing to build or do — to close the gap to our competitors (Polsia, Pancake, NanoCorp) and reach the next revenue milestone (first signup, first sale, launch). Use when the owner asks "what's next", "what should we build next", "what gets us closer to <rival>", "how do we get our first sale", or when a tick/session needs to re-pick priorities instead of just draining the backlog top-down. Produces ONE pick with a verifiable success criterion + the honest binding constraint, not a list.
---

# next-move — pick the one highest-leverage thing to build next

The recurring co-founder question: *given where our rivals are and where our money is, what is
the single most valuable thing to do next?* This skill turns that instinct into a repeatable
decision. It does **not** drain the backlog top-down — it re-derives the pick from reality each
time, because the binding constraint moves.

Core discipline (why this exists): the honest answer is often **"the highest-leverage move is
gated (a send / a spend), and no amount of building substitutes for it."** A loop that can only
build will happily build forever to avoid the real blocker. This skill's job is to name that
blocker out loud, then pick the best move *given* it — buildable now if one clears the bar,
boarded for the human if the real lever is theirs to pull.

## 1. Ground in reality (read, don't recall)
Load the current picture — never answer from memory:
- `private/memory/competitive-landscape-*.md` — where rivals are, table stakes, our open gap.
- `private/charter.md` — the venture, the pricing, and the **Definition of success** (the goal
  we're steering toward; that's the destination, not "beat rival X" in the abstract).
- `private/state/kpis.md` — what's actually measured (signups, visits, revenue). The truth.
- `private/state/backlog.md` + `private/state/pnl.md` — what's queued, what's spent, runway.
- `tools/tasks.sh list` — what's already on the human's plate (don't re-board it).

## 2. Name the destination concretely
"Closer to Polsia/Pancake/NanoCorp" is not a goal — it's a direction. Convert it to the **next
measurable milestone** on the path: usually the charter's Definition of success, or the nearest
sub-step (first human signup → first pre-order → launch that produces N signups). Write it as
one line with a number. Everything below is judged against *this*, not against vibes.

## 3. Find the binding constraint (the honest part)
Look at the KPIs and ask: **what is the ONE thing whose absence is blocking the milestone right
now?** Distribution? Trust/credibility? A missing table-stakes feature? Product itself? Be
ruthless — there is usually exactly one, and it's usually not the thing that's most fun to build.
- If signups are ~0 but the page works and converts fine on the humans who arrive → the
  constraint is **distribution**, not the product. More features won't move it.
- If traffic is fine but nobody trusts it → the constraint is **credibility** (proof, /live
  feed, verified revenue), build that.
- If the launch is what unlocks eyeballs → the constraint is **launch-readiness**, build the
  artifact the launch needs, then the launch itself is the (gated) move.

## 4. Enumerate candidate moves — tag each
List 3–6 real candidates (pull from the backlog + the competitive gap + the binding
constraint). For each, tag four things in one line:
- **Unlocks** — what milestone-relevant thing it produces (be specific, tie to §2).
- **Buildable | Gated** — can the loop ship it with the keys it holds (Cloudflare/Supabase/repo/
  deploy), or does it need a human gate (spend / outbound send / their-identity credential /
  judgment)? (CLAUDE.md hard rules + #12.)
- **Effort** — rough (an hour / a tick / multi-tick).
- **Leverage** — does it move the binding constraint (§3), or a secondary one? Table-stakes-we-
  lack outrank nice-to-haves; a thing the *next* move depends on outranks a thing nothing waits on.

## 4.5 The Rule-17 gate (distribution-first — check BEFORE you let "build" win)
Run `tools/scoreboard.sh` (tokens/$ burned vs income per venture). Then apply CLAUDE.md #17: a
**new venture, or a new feature/page/tool, is DISQUALIFIED as the pick** while any active venture
still has loop-doable GTM undone or no stats flowing. Building is the tar pit; selling what exists
is the job — the best ad is our own company actually converting. If the scoreboard shows a `SELL`
verdict (burn, $0 in, no live GTM), the pick MUST come from the distribution set (ship+submit SEO,
GEO, directories, draft+board outreach), never the construction set. Owner-gated distribution
(sends/spend) counts as "done on our side" once boarded — that unblocks building, a still-unworked
GTM lever does not. Only after every active venture clears this do build-candidates re-enter §5.

## 5. Pick ONE — apply the tie-breakers in order
1. **Binding-constraint first.** A move that clears §3 beats any move that doesn't, even a
   smaller one. Don't build a dashboard when distribution is the wall. (And per §4.5, a build
   candidate can't even be the pick while GTM on a live venture is unworked.)
2. **Hundred-Dollar Test** (CLAUDE.md #6). Of the constraint-movers, which is the highest-
   leverage hour/$100 right now? Cheapest path to the milestone wins.
3. **Buildable-now breaks ties, never overrides §1.** If the top constraint-mover is gated
   (a send), the pick is: *do the full buildable prep now, and board the irreducible gated
   remainder for the human* (CLAUDE.md #12). Do NOT substitute a lower-leverage buildable thing
   and call it the next move — that's building to dodge the blocker. Name the gated lever as the
   real next move; the buildable prep is you doing your half.
4. **Table-stakes before differentiators before polish.** If we lack something the whole
   category has (e.g. a public /live feed), that gap costs credibility on every visit — it
   usually outranks a novel feature no one's asking for yet.

## 6. Output — the pick, not a menu
Return exactly:
- **The binding constraint** (§3) in one honest sentence.
- **The pick** — one move, with its **verifiable success criterion** (Principle 4: "page returns
  200 and shows X", "row lands in table Y", not "build Z").
- **Why it wins** — 2–3 bullets tying it to the constraint + the tie-breakers.
- **The gated lever, named** — if the true highest-leverage move needs the human (a send/spend),
  say so plainly and state what buildable half you'll do now vs. what goes on the board.
- **Runner-up** — one line, so the owner can override.
- **Then act** (CLAUDE.md #12/#16): do the buildable half now toward its success criterion,
  independently verify it (`tools/verify-goal.md`), and board the irreducible remainder via
  `tools/tasks.sh add`. Anything you touched lands on the kanban with the right status.

## Anti-patterns (this skill exists to prevent these)
- **Backlog autopilot** — doing the top backlog item because it's on top, when the constraint
  moved underneath it.
- **Building to avoid the blocker** — shipping a fifth SEO page when the wall is that nobody
  sees the site (distribution is gated, so we build instead of asking). Name the gate.
- **Menu instead of a decision** — listing six options and letting the owner pick is abdication.
  Pick one, show the runner-up, invite override.
- **Vanity table-stakes over the real constraint** — building the /live feed because rivals have
  it, when we have zero traffic to *be* live about. Table-stakes matter, but not ahead of §3.
- **A "build" as the success criterion** — "build the dashboard" is not verifiable; "hq.limed.tech
  loads authed and every number traces to a real source" is.

## Cost note
This is a ~few-minute reasoning pass over files already on disk. Run it at the start of a tick
when the backlog and reality have drifted, or any time the owner asks "what's next" — it's
cheaper than a tick spent building the wrong thing.
