# tool: Supabase DDL runner (db.sh)

One **shared** Supabase project for all of autocomp; each venture gets its own Postgres
**schema** (isolation without burning the free tier's project limit). The loop provisions and
migrates schemas itself via the Supabase **Management API** — no DB password or `psql` needed.

## Keys (.env)
- `SUPABASE_ACCESS_TOKEN` — Personal Access Token (`sbp_…`), SECRET. Grants Management API.
- `SUPABASE_PROJECT_REF` — the project ref (subdomain of `SUPABASE_URL`).
- (REST/data uses `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`; browser uses `SUPABASE_ANON_KEY`.)

## Use
```
tools/db.sh query "select version()"          # inline SQL / batch
tools/db.sh file migrations/2026-… .sql       # run a .sql file
```
Returns the JSON rows on success; prints the Postgres error and exits non-zero on failure
(never fakes success — CLAUDE.md honest-reporting).

## Gating
- **Ungated (loop does it):** `CREATE SCHEMA/TABLE`, indexes, RLS policies, non-destructive
  migrations — infra, no money/sends. (Same class as creating a Stripe link.)
- **Gated (approval + phone push):** `DROP`/`TRUNCATE`/`DELETE`-at-scale or any destructive or
  irreversible data change → `private/state/approvals.md` first. The board/data is never the
  approval gate itself.

## Convention: schema per venture
Name a venture's schema after its slug (e.g. `weeklybrief`), enable RLS on its tables, and keep
shared ops tables (e.g. the kanban `public.tasks`) in `public`. Provision from a template so a
new idea gets a consistent starting schema.
