# autocomp kanban — setup (auto.limed.tech)

A shared task board: you manage cards from your phone/browser (Google login); the loop
syncs via `tools/tasks.sh`. Architecture: Supabase (DB+Auth+REST) + a static page served by
the VPS nginx, fronted by Cloudflare for HTTPS.

The files are already built (`kanban/`, `tools/tasks.*`). These are the steps only you can
do — keys, OAuth, DNS, and the one sudo install. Do them in order.

---

## 1. Supabase project  → gives URL + 2 keys
1. supabase.com → New project (free tier). Pick a region near you.
2. **SQL Editor** → paste all of `kanban/schema.sql` → Run. (Confirm the owner email in the
   RLS policy is `YOUR-EMAIL@example.com` — edit if not.)
3. **Settings → API** → copy:
   - **Project URL** and **anon public key** → into `kanban/config.js` (see step below).
   - **service_role key** → into the VPS `.env` as `SUPABASE_SERVICE_KEY`, and the URL as
     `SUPABASE_URL`. (service_role is a SECRET — never in the browser/git.)

```
# on the VPS, in /home/j/autocomp/.env
SUPABASE_URL=https://YOUR-ref.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...   # service_role, secret
```

Then create the browser config:
```
cd /home/j/autocomp/kanban
cp config.example.js config.js
# edit config.js → SUPABASE_URL + SUPABASE_ANON_KEY (anon, public-safe)
```

## 2. Google OAuth  → lets you sign in
1. Supabase → **Authentication → Providers → Google** → enable. Note the **callback URL** it
   shows (looks like `https://YOUR-ref.supabase.co/auth/v1/callback`).
2. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → Web
   application. Authorized redirect URI = that Supabase callback URL.
3. Paste the Google **client ID + secret** back into Supabase's Google provider → save.
4. Supabase → Authentication → URL Configuration → set **Site URL** to
   `https://auto.limed.tech`.
5. (Optional, recommended) Longer sessions: the access-token lifetime defaults to 1h, which
   feels like being logged out "every few hours" if a refresh hiccups. Raise it to the max —
   Supabase → Authentication → Sessions → JWT expiry = `604800` (7 days), or via the
   Management API: `PATCH /v1/projects/<ref>/config/auth {"jwt_exp":604800}`. Leave
   time-box / inactivity-timeout at 0 (never) so the refresh token keeps sessions alive
   indefinitely.

## 3. Cloudflare DNS  → makes the name resolve (+ HTTPS)
1. Cloudflare → limed.tech → DNS → Add record: **A**, name `auto`, IPv4
   **YOUR-VPS-IP**, Proxy **ON** (orange cloud).
2. SSL/TLS mode: **Flexible** (Cloudflare terminates HTTPS, talks HTTP to the origin :80).
   _(Upgrade to Full later if we add an origin cert.)_

## 4. Serve it on the VPS  (needs your sudo — run these)
```
# publish the static files where nginx can read them
sudo mkdir -p /var/www/auto.limed.tech
sudo cp /home/j/autocomp/kanban/{index.html,style.css,app.js,config.js} /var/www/auto.limed.tech/

# install the vhost
sudo cp /home/j/autocomp/kanban/auto.limed.tech.nginx.conf /etc/nginx/sites-available/auto.limed.tech
sudo ln -sf /etc/nginx/sites-available/auto.limed.tech /etc/nginx/sites-enabled/auto.limed.tech
sudo nginx -t && sudo systemctl reload nginx
```
Re-run the `cp ... /var/www/...` line whenever the kanban files change (or tell me and I'll
prep a one-line deploy).

## 5. Verify
- Visit `https://auto.limed.tech` → "Sign in with Google" → your board loads.
- Add a card in the browser → on the VPS: `tools/tasks.sh list` should show it.
- `tools/tasks.sh add "ping from agent" 1 "hello"` → the card appears in your browser (To do).

---

### What stays gated even with the board live
The board is a convenience channel, not the approval gate. Money / outbound sends /
destructive actions STILL go through `state/approvals.md` + a phone push (CLAUDE.md hard rule).

## End-to-end auth testing (no owner needed)
A dedicated Supabase auth user (`LOOP_TEST_EMAIL`/`LOOP_TEST_PASSWORD` in `.env`) carries
SELECT-only RLS policies mirroring the owner's read paths (tasks, autocomp.activity,
autocomp.companies). `tools/authtest.sh get <rest-path> [profile]` mints its JWT and replays
any browser fetch; for full-UI tests, inject the password-grant session JSON into
`localStorage["sb-<ref>-auth-token"]` and reload — supabase-js boots it like a real sign-in.
Writes must stay owner-only: a PATCH with the test JWT has to return `[]` (0 rows).
