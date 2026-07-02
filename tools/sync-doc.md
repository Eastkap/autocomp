# tool: the sync docs (Google Docs as the lightweight task board)

Our interim "kanban" until we stand up the Supabase board. Two Google Docs, chosen for
simplicity — no OAuth, DNS, or hosting to set up (CLAUDE.md: simplicity first):

- **"autocomp — TO-DO"** — ID `1qiVCBraDXmpW2YH7HlLU6Wqs4jVF_fwbozZmpSMZZ4Y`
  (also `.env` `SYNC_DOC_ID`, non-secret). The **owner edits** this; the loop **reads** it
  each tick. This is the inbox.
- **"autocomp — DONE (<date>)"** — the loop's progress report to the owner. Created fresh
  each time there's new progress (see limitation below); newest dated doc is current.

## Hard limitation of the Drive tools
The MCP has **read / create-new / copy only — NO edit-in-place**. Consequences:
- The loop **cannot** modify a doc after creating it (not the owner's, not its own).
- So the **TO-DO doc is owner-maintained**: the loop never edits it; it only reads and acts.
  The loop reports what it picked up / did via `tools/notify.sh` (phone push),
  `private/state/approvals.md`, the ledger, and the session — the owner clears TO-DO lines himself.
- The **DONE doc** is refreshed by creating a NEW dated doc (create_file), not by editing;
  the authoritative running log is always `private/state/ledger.md`.

## Suggested format in the doc
Free text is fine; I'll parse intent. A light convention helps:
```
TODO: <thing you want done>          # a task for me
Q: <question>                        # answer you want from me (I'll push/reply)
ANSWER: <your reply to my question>  # when I've asked you something
NOTE: <context / decision>           # background, no action needed
DONE: <strike or delete when handled>
```
I won't delete/strike items (can't write). When I finish one, I note it in the tick report +
ledger and (for anything needing you) push via ntfy — you clear the line in the doc yourself.

## How the tick uses it (§2.5 of the tick skill)
1. **Read** the doc (`read_file_content`, `includeComments: true`) — its `SYNC_DOC_ID`.
2. Diff against what was already handled (ledger). Fold **new** `TODO:` / `Q:` / `ANSWER:`
   lines into this tick's plan as backlog items.
3. Act on ungated items; for gated ones (money/send/destructive) keep the normal
   `private/state/approvals.md` + ntfy gate — the doc is a convenience inbox, **not** the approval gate.
4. Report what was picked up + done in the tick report and ledger.

If the Drive MCP tool isn't available in a given run (e.g. headless/cron without the
connector), treat the doc read as skipped for that tick and say so — never fake its contents.
