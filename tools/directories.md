# tool: launch directories — standing SEO step for EVERY venture launch

When a venture's site goes live, submit it to startup/launch directories: cheap backlinks,
referral trickle, and indexing signals. This is a **standing playbook** — run it once per
venture (and re-run for major relaunches).

## Source lists (curated by the owner)
- **`tools/launchdirectories-list.md`** — MASTER WORKLIST: full scrape of launchdirectories.com
  (123 dirs, 100 free/freemium ranked by domain authority + dofollow, with per-dir Weekly Brief
  status). Start here; it carries a one-command re-scrape recipe at the bottom.
- https://startupsubmit.app/best-startup-directories — meta-list of directories
- https://ideaproof.io/tools/category/launch-directories — meta-list, launch-focused
- https://launchdirectories.com — source of the master list above (re-scrape when refreshing)
- https://indiepa.ge — maker profile page linking all ventures (one per owner, not per venture)

## How the loop runs it
1. **Prepare the submission kit (ungated, do in a tick).** One file per venture in
   `private/memory/<venture>-directory-kit.md`:
   - name, one-liner (≤60 chars), short description (~160 chars), long description (~500 chars)
   - URL, category/tags, pricing line, maker name + handle, logo/screenshot paths
   - Write once, reuse across every form.
2. **Shortlist directories (ungated).** From the source lists pick ~10–20 free, live,
   relevant ones (skip paid listings — that's a money gate). Record the shortlist + each
   directory's form URL in the kit file.
3. **Submit (GATED — outbound publication).** Submitting is an outbound send to a third
   party → one batch approval per venture in `private/state/approvals.md`
   ("directory submission batch: <venture>, N sites") + phone push. After approval:
   - Loop submits the no-login forms itself (via web tools) and records each result.
   - Login-required ones (Product Hunt, etc.) go to the kanban as human cards with the kit
     text ready to paste.
4. **Record (honest).** Per directory: submitted / pending review / live / rejected, with
   dates, in the kit file. Never claim a listing that isn't verified live. Re-check on a
   later tick and log live URLs in `private/state/kpis.md` (backlinks count).

## Rules
- Free listings only by default; any paid placement = money gate.
- Match each directory's rules (some want founders' accounts — those are human cards).
- Don't fake traction numbers in listings; use measured ones or omit.
- **APPEND, never overwrite**, when saving credentials/notes to `.secrets/accounts.env` or
  `.secrets/directory-accounts.md` (`>>`, not `>`) — a Jul-13 overwrite left accounts.env
  holding only its newest entry.
