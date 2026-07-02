# Tool: Deploy — Cloudflare Pages + Workers (serverless-first)

Shipping a site/app is a *deploy* action (not a money gate) and is **ungated** — the loop does
it autonomously. Architecture: **CF Pages** for sites, **CF Pages Functions / Workers** for
backends, **Supabase** for data, the VPS for the loop/crons only. limed.tech is on Cloudflare,
so one API token (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`) drives DNS + Pages + Workers.

## Deploy a static site (+ optional Functions) to Pages
```
# from the SITE directory (not the repo root — see gotcha)
cd private/<venture>/site      # or private/site
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CI=1   # from .env
npx --yes wrangler@latest pages project create <name> --production-branch=main   # once, ok if exists
npx --yes wrangler@latest pages deploy . --project-name=<name> --branch=main --commit-dirty=true
```
- **GOTCHA (learned the hard way):** wrangler detects the `functions/` dir **relative to the
  deploy directory you pass**. Deploying `wrangler pages deploy private/site` from the repo root
  uploaded only static files and **silently skipped the Function** (POST → 405). Fix: `cd` into
  the site dir and `pages deploy .`. Confirm the log shows **"✨ Compiled Worker successfully"**
  and **"Uploading Functions bundle"** — if those lines are absent, Functions did NOT deploy.

## Pages Functions (backends, same-origin, no CORS)
- Put handlers in `<site>/functions/api/<name>.js`, export `onRequestPost({request, env})`, etc.
  Served at `/api/<name>` on the same domain → the site's forms POST same-origin, no CORS.
- Secrets: `printf '%s' "$VAL" | npx wrangler pages secret put NAME --project-name=<name>`
  (e.g. `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`). Never ship secrets in client code.

## Custom domain (subdomain of limed.tech)
```
# bind the domain to the Pages project
curl -s "$CF/accounts/$ACCT/pages/projects/<name>/domains" -H "$AUTH" -H 'content-type: application/json' -d '{"name":"<sub>.limed.tech"}'
# it is NOT auto-created — add the proxied CNAME yourself:
curl -s "$CF/zones/$ZONE/dns_records" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"type":"CNAME","name":"<sub>","content":"<name>.pages.dev","proxied":true,"ttl":1}'
```
Cert provisioning takes a few minutes (custom domain 522 → 200 while "initializing"). Find your
zone id with `GET /zones?name=<your-domain>` (store it as `CLOUDFLARE_ZONE_ID` in `.env`).

## Verify (Principle 4 — always)
Fetch the live URL: `curl -s -o /dev/null -w '%{http_code}'` must be **200** and the headline
must render. Test any Function end-to-end (POST → confirm the row/side-effect), then clean up
test data. CF Pages serves clean URLs (`/page`, not `/page.html`; `.html` 308-redirects).

## Rules
- Deploy = ungated. **Buying a domain / any paid plan = money gate → `private/state/approvals.md`.**
- Never put secrets in client code — use Pages/Workers secrets (platform vault).
- Fallback: **Vercel** (`vercel --prod`, `$VERCEL_TOKEN`) only if a venture needs heavy Next.js.
