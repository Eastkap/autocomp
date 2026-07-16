-- 2026-07-15-role-lanes.sql — role-agent lanes migration (plan 2026-07-15-001).
-- Apply with: tools/db.sh file tools/sql/2026-07-15-role-lanes.sql
-- Every statement is IDEMPOTENT (if not exists / create or replace / drop-then-add)
-- so the file is safely re-runnable after later units append to it.
--
-- U1: role tags on cards + atomic claim + `review` status.

-- Role tags: which lane(s) a card is routed to. Empty = legacy/untagged card.
alter table public.tasks add column if not exists tags text[] not null default '{}';

-- Claim attribution: which lane holds the card and since when — feeds the
-- stuck-`doing` reaper (U10) and double-work audits. Nullable: unclaimed cards.
alter table public.tasks add column if not exists claimed_by text;
alter table public.tasks add column if not exists claimed_at timestamptz;

-- Widen the status check with `review` — the post-completion verification state
-- between doing and done (acting lanes finish into review; only a verifier
-- verdict moves a card to done). Drop-then-add keeps this re-runnable; all
-- pre-existing values (todo/doing/done/blocked) remain valid.
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('todo','doing','done','blocked','review'));

-- Atomic claim: exactly one cycle gets a card (FOR UPDATE SKIP LOCKED — same
-- shape as claim_agent_job/claim_solve_job). Roles claim their highest-priority
-- (priority DESC — higher = sooner in this schema) oldest-first tagged card:
--   * qa      → status='review' cards tagged qa; the card STAYS in review
--               (verdict work must remain visible on the board) but gets
--               claimed_by set; `claimed_by is distinct from 'qa'` stops a
--               later cycle from re-claiming the same verdict job.
--   * others  → status='todo' cards tagged with the role; todo → doing.
-- Human-assigned cards are NEVER claimable by any lane.
-- security definer so execution rights alone (service_role) suffice.
create or replace function public.claim_task(p_role text)
returns setof public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare t public.tasks;
begin
  if p_role = 'qa' then
    update public.tasks
       set claimed_by = p_role, claimed_at = now()
     where id = (select id from public.tasks
                  where status = 'review'
                    and 'qa' = any(tags)
                    and assignee <> 'human'
                    and claimed_by is distinct from 'qa'
                  order by priority desc, created_at asc
                  limit 1
                  for update skip locked)
    returning * into t;
  else
    update public.tasks
       set status = 'doing', claimed_by = p_role, claimed_at = now()
     where id = (select id from public.tasks
                  where status = 'todo'
                    and p_role = any(tags)
                    and assignee <> 'human'
                  order by priority desc, created_at asc
                  limit 1
                  for update skip locked)
    returning * into t;
  end if;
  if found then return next t; end if;
  return;
end $$;

-- Lock the RPC down to the service key: the anon key ships in kanban/config.js,
-- so browser-side callers must get a permission error, never a card.
revoke execute on function public.claim_task(text) from public, anon, authenticated;
grant execute on function public.claim_task(text) to service_role;

-- Claim-path indexes.
create index if not exists tasks_tags_gin on public.tasks using gin (tags);
create index if not exists tasks_status_idx on public.tasks (status);

-- U2: shared context store (autocomp.context) + lane heartbeats (autocomp.lanes).

-- Schema guard (already exists — registry tables live here; keep it re-runnable).
create schema if not exists autocomp;

-- Shared coordination narrative: tagged, INSERT-ONLY rows the lanes write instead
-- of racing on one ledger file. Three-store split (tools/context.md):
--   autocomp.context  = coordination narrative (this table)
--   autocomp.activity = cost/metrics index
--   private/state/ledger.md = append-only audit digest
create table if not exists autocomp.context (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  lane         text not null,
  company_slug text,
  kind         text not null check (kind in ('decision','result','blocker','handoff','learning')),
  tags         text[] not null default '{}',
  body         text not null,
  refs         jsonb
);

create index if not exists context_created_at_idx on autocomp.context (created_at);
create index if not exists context_tags_gin on autocomp.context using gin (tags);

-- Append-only, enforced against the REAL write paths (mirrors the ledger hard rule):
--  1. revoke UPDATE/DELETE from service_role — the PostgREST service-key path.
--     (The autocomp schema's default ACL grants service_role ALL on new tables;
--     the revoke stays effective across re-runs because `if not exists` skips
--     table re-creation, and re-revoking is a no-op.)
--  2. a BEFORE UPDATE OR DELETE trigger that raises — the backstop that even the
--     table owner (db.sh / Management API) hits. Statement-level, so it fires
--     even for zero-row-matching UPDATE/DELETE statements.
revoke update, delete on autocomp.context from service_role;

create or replace function autocomp.context_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'autocomp.context is append-only';
end $$;

drop trigger if exists context_append_only on autocomp.context;
create trigger context_append_only
  before update or delete on autocomp.context
  for each statement execute function autocomp.context_append_only();

-- RLS on context: enabled with NO policies — service-path only. service_role
-- bypasses RLS for INSERT/SELECT (intended); its UPDATE/DELETE stay blocked by
-- the revoke + trigger above. No anon/browser surface.
alter table autocomp.context enable row level security;

-- Lane liveness / sweep-cursor / host-lease surface: one row per lane.
--   last_cycle_at  = liveness heartbeat (watchdog reads this — U7)
--   last_swept_at  = context-sweep cursor, stamped AT READ TIME (tools/context.md)
--   host/lease_until = cross-host single-instance lease (U5)
create table if not exists autocomp.lanes (
  lane          text primary key,
  last_cycle_at timestamptz,
  last_status   text,
  last_swept_at timestamptz,
  host          text,
  lease_until   timestamptz,
  note          text
);

insert into autocomp.lanes (lane) values ('ceo'), ('cto'), ('qa'), ('gtm')
  on conflict (lane) do nothing;

-- Browser read surface for the kanban lane-status strip (U8): mirror EXACTLY how
-- autocomp.activity exposes the Ticks tab — SELECT granted to authenticated, rows
-- locked by RLS to the owner (+ loop-test) email. anon has no autocomp schema
-- usage, so bare-anon-key reads stay blocked entirely.
grant select on autocomp.lanes to authenticated;
alter table autocomp.lanes enable row level security;

-- Replace both placeholder emails before applying on a fresh install (repo convention:
-- kanban/schema.sql uses the same placeholders; hard rule — real addresses never live in
-- git-tracked files, this repo mirrors publicly). The LIVE project already carries the
-- real policies: re-running this file with the placeholders would REPLACE them and hide
-- the lane strip from the owner — set real values first when re-running.
drop policy if exists "owner read" on autocomp.lanes;
create policy "owner read" on autocomp.lanes
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'YOUR-EMAIL@example.com');

drop policy if exists "loop-test read" on autocomp.lanes;
create policy "loop-test read" on autocomp.lanes
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'YOUR-TEST-USER@example.com');

-- PostgREST exposure: the autocomp schema is already in PostgREST's exposed
-- schemas (registry.sh talks to it via Accept-Profile: autocomp) — nothing to do,
-- and nothing here changes that.

-- U10: cost-attribution target for framework/whole-board lane cycles.
-- The role prompts tell a cycle to write slug `company` when it worked no single
-- venture, and the runner then calls `registry.sh logcost company …` — but
-- activity.slug has a FK to companies(slug), so without this row every such
-- harvest 409s and the cycle's cost silently never reaches the daily burn gate
-- (found live in U10 fault-injection: qa cycle cost $1.55 was dropped).
-- status=paused keeps it out of `registry.sh next` venture rotation.
insert into autocomp.companies (slug, name, one_liner, stage, status, priority)
  values ('company', 'autocomp company-wide (framework / whole-board work)',
          'pseudo-venture: attribution target for lane cycles that work no single venture',
          'build', 'paused', 0)
  on conflict (slug) do nothing;

-- U10 note: no new indexes were needed here — verified live via pg_indexes that U1/U2
-- already created tasks_tags_gin, tasks_status_idx, context_created_at_idx, and
-- context_tags_gin (2026-07-16).
