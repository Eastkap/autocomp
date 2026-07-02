-- autocomp kanban — tasks table + RLS. Run once in Supabase SQL Editor.
-- Two-way task channel between the human (browser, Google auth) and the agent
-- (the loop, via service-role key server-side).

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  status      text not null default 'todo'
              check (status in ('todo','doing','done','blocked')),
  assignee    text not null default 'agent'   -- who needs to act next
              check (assignee in ('human','agent')),
  created_by  text not null default 'human'
              check (created_by in ('human','agent')),
  priority    int  not null default 0,        -- higher = sooner
  notes       text default '',                -- running back-and-forth
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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
