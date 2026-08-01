-- Store the receiving MTA's own SPF/DKIM/DMARC verdict on every message the bot inbox takes.
-- Without it we can only infer that sender authentication works because mail gets delivered,
-- which tells us nothing the first time something lands in a spam folder. See tools/mail.md.
--
-- Blocked 2026-08-01 (Tick 134): tools/db.sh returns HTTP 401 — SUPABASE_ACCESS_TOKEN is
-- expired. mail/worker.js already writes the field and falls back to an insert without it,
-- so applying this is a pure unlock, safe to run at any time.
alter table autocomp.inbox add column if not exists auth_results text;
