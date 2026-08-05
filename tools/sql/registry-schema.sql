-- autocomp registry schema — the multi-venture brain + cost/metrics index.
-- Run once on a fresh instance, BEFORE tools/sql/2026-07-15-role-lanes.sql (which assumes
-- autocomp.companies already exists and inserts the 'company' attribution row into it).
--
-- Fresh-install order:
--   1. tools/sql/registry-schema.sql   (this file — autocomp schema + companies/activity/metrics_daily)
--   2. kanban/schema.sql               (public.tasks + RLS + claim_task)
--   3. tools/sql/2026-07-15-role-lanes.sql   (tags/claim_task/context/lanes + 'company' row)
-- Then expose the `autocomp` schema to PostgREST (add it to the project's db_schema list) so
-- registry.sh/scoreboard.sh can read it via `Accept-Profile: autocomp`.
--
-- Consumed by: tools/registry.sh (companies + activity) and tools/scoreboard.sh (activity +
-- metrics_daily). Every statement is IDEMPOTENT (if not exists / drop-then-add) — safe to re-run.
-- Provenance: these tables pre-existed in the original live project from an uncommitted migration;
-- this file captures them so a fresh clone can rebuild the ops backend (added 2026-07-18).

create schema if not exists autocomp;

-- The multi-venture registry. One row per venture; `status='active'` rows enter tick rotation
-- (registry.sh next). The 'company' pseudo-venture (status='paused', inserted by role-lanes.sql)
-- is the cost-attribution target for lane cycles that worked no single venture.
create table if not exists autocomp.companies (
  slug         text primary key,
  name         text,
  one_liner    text,
  stage        text,
  status       text not null default 'active',
  priority     int  not null default 0,
  last_tick_at timestamptz,
  last_task    text,
  created_at   timestamptz not null default now()
);

-- Per-tick / per-cycle activity + measured model cost (registry.sh log / logcost;
-- scoreboard.sh sums tokens + cost_usd per slug). Rows are per-event and additive.
create table if not exists autocomp.activity (
  id        bigint generated always as identity primary key,
  slug      text not null,
  task      text,
  detail    text,
  actor     text default 'loop',
  tokens    bigint,
  cost_usd  numeric,
  at        timestamptz not null default now()
);
create index if not exists activity_slug_at_idx on autocomp.activity (slug, at desc);

-- Daily funnel metrics per company (scoreboard.sh: traffic / signups / revenue), one row per day.
create table if not exists autocomp.metrics_daily (
  id            bigint generated always as identity primary key,
  company_slug  text not null,
  day           date not null default current_date,
  cf_visits     int default 0,
  human_visits  int default 0,
  signups       int default 0,
  revenue_usd   numeric default 0,
  unique (company_slug, day)
);

-- Referential integrity: activity/metrics rows must name a real company. The activity FK is why
-- role-lanes.sql seeds the 'company' row — lane-cost harvests with slug='company' would 409
-- without it. Drop-then-add keeps these re-runnable.
alter table autocomp.activity      drop constraint if exists activity_slug_fkey;
alter table autocomp.activity      add  constraint activity_slug_fkey
  foreign key (slug) references autocomp.companies(slug);
alter table autocomp.metrics_daily drop constraint if exists metrics_daily_company_slug_fkey;
alter table autocomp.metrics_daily add  constraint metrics_daily_company_slug_fkey
  foreign key (company_slug) references autocomp.companies(slug);

-- Grants: a freshly-created schema does NOT auto-grant the PostgREST roles, so the service key
-- hits "42501 permission denied for schema" without these (learned 2026-07-18).
grant usage on schema autocomp to service_role, anon, authenticated;
grant all privileges on all tables in schema autocomp to service_role;
grant all privileges on all sequences in schema autocomp to service_role;
alter default privileges in schema autocomp grant all on tables to service_role;
