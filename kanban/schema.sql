-- autocomp kanban — tasks table + RLS. Run once in Supabase SQL Editor.
-- Two-way task channel between the human (browser, Google auth) and the agent
-- (the loop, via service-role key server-side).

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  status      text not null default 'todo'
              -- review = done-by-the-actor, awaiting a verifier verdict (role lanes)
              check (status in ('todo','doing','done','blocked','review')),
  assignee    text not null default 'agent'   -- who needs to act next
              check (assignee in ('human','agent')),
  created_by  text not null default 'human'
              check (created_by in ('human','agent')),
  priority    int  not null default 0,        -- higher = sooner
  notes       text default '',                -- running back-and-forth
  tags        text[] not null default '{}',   -- role lanes routing (ceo/cto/qa/gtm/…)
  claimed_by  text,                           -- lane holding the card (claim_task)
  claimed_at  timestamptz,                    -- when it was claimed (reaper/audits)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- claim-path indexes (role lanes)
create index if not exists tasks_tags_gin on public.tasks using gin (tags);
create index if not exists tasks_status_idx on public.tasks (status);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Row-level security: only the owner's signed-in browser session can touch rows.
-- The agent uses the service-role key, which bypasses RLS entirely.
alter table public.tasks enable row level security;

-- EDIT this to your Google account before running.
drop policy if exists "owner full access" on public.tasks;
create policy "owner full access" on public.tasks
  for all
  using  ( (auth.jwt() ->> 'email') = 'YOUR-EMAIL@example.com' )
  with check ( (auth.jwt() ->> 'email') = 'YOUR-EMAIL@example.com' );

-- Realtime (so the board live-updates when the agent changes a card).
alter publication supabase_realtime add table public.tasks;

-- Atomic role-lane claim: exactly one cycle gets a card (FOR UPDATE SKIP LOCKED).
-- qa claims review-status qa-tagged cards (card stays in review — verdict work);
-- other roles claim todo-status cards tagged for them (todo → doing).
-- Human-assigned cards are never claimable. Executable by service_role ONLY —
-- the anon key ships to the browser and must get a permission error.
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

revoke execute on function public.claim_task(text) from public, anon, authenticated;
grant execute on function public.claim_task(text) to service_role;
