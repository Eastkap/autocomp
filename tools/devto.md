# Tool: dev.to (Forem API) publishing

GTM/GEO content channel. dev.to is high-domain-authority, gets indexed fast, and is
frequently cited by AI answer engines — a durable place to plant venture-relevant articles.
Always set `canonical_url` back to the venture's own page when cross-posting existing content,
so dev.to isn't treated as the canonical source.

## Identity policy
The API key belongs to the **OWNER'S PERSONAL dev.to account, @eastkap** — the owner handed
the key over (2026-07-13); that handoff **is** the standing authorization to draft AND publish
(same pattern as the bot-identity GTM carve-out in CLAUDE.md), but everything ships under
their personal byline. Quality bar is high — no AI-slop copy, no filler.

- **Drafts-first is the default workflow**: the loop writes a draft, then either publishes
  once confident it's genuinely good, or leaves it for the owner to review and publish.
- Nothing spammy or high-volume — this is a personal author's feed, not a bot channel. A
  handful of substantive posts beats a stream of thin ones.

## Usage
```
tools/devto.sh me                          # identity check — expect username "eastkap"
tools/devto.sh list [n]                    # published articles: id, published, title, url, views
tools/devto.sh drafts [n]                  # unpublished (draft) articles
tools/devto.sh get <id>                    # full article JSON
tools/devto.sh post <file.md>              # create as a DRAFT (published:false)
tools/devto.sh post <file.md> --publish    # create and publish immediately
tools/devto.sh publish <id>                # flip an existing draft to published
tools/devto.sh unpublish <id>              # pull a published article back to draft
tools/devto.sh update <id> <file.md>       # replace body_markdown from a file (PUT)
```

`post` accepts either a plain markdown file (first `# heading` becomes the title, the rest
becomes the body) or a file with Jekyll front matter (`---` as the first line), in which case
the whole file is sent as `body_markdown` and Forem parses the front matter itself.

There is **no delete endpoint** in the Forem API — a created article (even a draft) is
permanent. Draft = not publicly visible, but it exists forever. Don't `post` casually.

**`get <id>` only works for published articles** — Forem's `GET /articles/{id}` 404s on
drafts even for the owner, authed or not (verified 2026-07-13). To check a draft, use
`drafts` (id/title/url list) or `update` (round-trips id/url on success); there's no way to
fetch a draft's full body back via the API.

## Front matter format (Forem/Jekyll)
```yaml
---
title: My Article Title
published: false
tags: webdev, ai, saas
canonical_url: https://our-venture.com/blog/original-post
series: Optional Series Name
description: One-line summary shown in previews.
---
Body markdown starts here.
```

## API reference
https://developers.forem.com/api

## Rate limits
dev.to rate-limits article creation. A `429` response means wait and retry manually — this
script deliberately has no retry logic, it just surfaces the error.

## Secrets
Key lives in `.env` as `DEVTO_API_KEY`, referenced by name only — never printed, never
inlined into prompts, ledger entries, or any git-tracked file.

## Status (2026-07-13): LIVE, verified end-to-end
`me`, `post` (draft), `drafts`, `update` all confirmed working against the real API under
@eastkap. No article has been published by the loop yet — only drafts exist so far.
