# launchdirectories.com — full scrape (123 directories, 2026-07-13)

Scraped from https://launchdirectories.com `initialDirectories` payload (Next.js flight stream).
This is the master worklist for the **standing launch-directory GTM step** (`tools/directories.md`).
Re-scrape recipe at the bottom. Sorted by Ahrefs Domain Rating (DR) desc within each pricing tier.

- **100 free / freemium** (Category = Free or Free + Paid) — the loop-doable set.
- **21 paid-only** — money gate; only with owner approval + Hundred-Dollar Test.
- **Status** column = where Weekly Brief already stands (from the kit, Parts F/G). Blank = not yet touched → candidate to queue.
- Status column reconciled against the ledger/kpis Tick 51 (2026-07-13) — the initial scrape missed ~10 already-submitted dirs. Keep it in sync when you submit/consume.

### Backlink audit — what our live listings actually bought us (measured 2026-08-01, Tick 135)

All 14 live listings accounted for. Each page was fetched logged-out and every anchor pointing at
brief.limed.tech was read verbatim. **Most of them pass no ranking authority at all:**

- **Banked dofollow (anchor in raw HTML, any crawler sees it) — 4:** StartupFA.me DR-83, Twelve Tools
  DR-81, PeerPush DR-74 (canonical host is `peerpush.com`; `.net` 301s to it), Smol Launch
  (`smollaunch.com/products/weekly-brief`, `rel="noopener noreferrer"`, 2 anchors).
- **Probable dofollow, NOT banked — 2:** trylaunch.ai DR-54 and hot100.ai DR-52 are Vite SPAs whose
  anchor exists only in the *rendered* DOM, absent from raw HTML. Google renders JS so it probably
  counts them; a non-rendering crawler sees no link. Do not count these as authority.
- **Confirmed nofollow — 5 (fetched today):** Turbo0 DR-80, SubmitAITools DR-75, Aura++ DR-71,
  Open Launch DR-71, FridayHunt DR-57. **+1 on older evidence:** SaasHunt DR-53 (`rel="noopener
  nofollow"` read Jul 18, not re-fetched).
- **No outbound link at all — 1:** Firsto DR-55. Its page is live and is our listing, but all 6
  brief.limed.tech occurrences are `favicon.im` image URLs — there is **no anchor to us**. The
  promised dofollow arrives only at its launch date (badge offer moves that to Aug 16 2026).
- **Could not be measured — 1:** AlternativeTo DR-79 returns HTTP 403 "Just a moment…" (Cloudflare) to
  plain HTTP. Needs a real browser (`fetch-protected` / Camoufox) to read its `rel`. Recorded as
  UNMEASURED, not as nofollow.

4 + 2 + 5 + 1 + 1 + 1 = **14**, which finally reconciles the long-disputed "14 live listings" total.

Four `Follow` column values in the table below were **wrong and are corrected**: Aura++, Turbo0,
Open Launch and FridayHunt were all recorded `yes` and all mark every anchor to us `rel="nofollow"`.
The `Follow` column came from launchdirectories.com's own scraped metadata — it describes the
directory in general, not the link *we* got. **Never trust it; fetch the page.**

**Consequence:** ~a month of directory work has produced **4 banked dofollow links**. That is the honest
explanation for a funnel reading 107 impressions / 0 clicks with every commercial query at position
34–70 — an authority problem, not a titles problem and not a coverage problem, and one that ten more
listings of the same kind will not close. Directories keep real referral and GEO value (answer engines
scrape these pages) so keep landing the cheap ones — just stop treating "N more listings" as the plan
for moving rank, and check whether a frontier row's outbound link is even followed before spending a
cycle on it.

### The frontier is THREE tiers, not two (durable correction, 2026-07-31, GTM lane)

Rows parked as "JS-hydrated / drainer frontier" are a mix of three genuinely different blockers.
**Probe for the auth gate before spending a cycle on a row** — the wrong tier wastes a whole cycle:

1. **JS-hydrated** — plain HTTP sees `forms=0`, but the form is really there. Local Camoufox ships it. *Just do it.*
2. **Session-gated** — Camoufox reaches the form, but submitting needs a live logged-in session (usually Google
   OAuth). Ships **only while the bot session lives**; today the bot Google session is expired (owner card `88a4ad07`).
3. **New-account-required** — the route redirects to the homepage for any visitor without a token, no matter how
   real the browser. Camoufox cannot fix this; it needs an account created (CEO / worker-2 gate).

Note the earlier "Camoufox drainer is down" premise on ~38 rows was **false** (measured 2026-07-31) — local Camoufox
reaches them. Treat any surviving "drainer down" wording below as unverified until that row is re-probed.

## Free / Freemium (100) — work these first, highest DR first
| Directory | URL | DR | Follow | Pricing | Status (WeeklyBrief) |
|---|---|--:|:--:|---|---|
| Reddit | https://www.reddit.com | 95 | no | Free | outreach lane, not a dir |
| Sourceforge | https://sourceforge.net | 92 | yes | Free + Paid | vendor-heavy |
| Hacker News | https://news.ycombinator.com | 91 | no | Free | GATED — not a bot-identity submit. A Show HN posts under the owner's PERSONAL identity (approval #1 routed HN to the copy-paste lane); a fresh bot account posting a product is flagged/killed by HN. Classified Jul 28 so sweeps stop counting it as unprobed. Free tier is otherwise fully classified. |
| G2 | https://www.g2.com | 91 | yes | Free + Paid | vendor-heavy |
| Product Hunt | https://www.producthunt.com | 91 | no | Free | blocked (new-account trust; Jul-17 VPS retry hit CF interstitial — retry job dcffe778 queued for homelab) |
| Capterra | https://www.capterra.com | 91 | yes | Free + Paid | vendor-heavy |
| Fazier | https://fazier.com | 82 | yes | Free + Paid | killed (memory) |
| Dang AI | https://dang.ai | 81 | yes | Free | BLOCKED Jul 14 (batch B): login magic-link never arrived, auth lands on /pricing — likely paid-only; acct exists |
| Twelve Tools | https://twelve.tools | 81 | yes | Free + Paid | LIVE Jul 17 — twelve.tools/brief-limed-tech, 3 followed backlinks (no rel); highest-DR live listing |
| Indie Hackers | https://indiehackers.com | 81 | yes | Free | human account |
| findly.tools | https://findly.tools | 80 | yes | Free + Paid | KILLED Jul 14 (batch B): captcha on submit form — solvable via 2captcha (SaaSHub recipe) but low value, solver spend not warranted |
| AlternativeTo | https://alternativeto.net | 79 | ? | Free | **`rel` UNMEASURED** — the listing page returns HTTP 403 "Just a moment…" (Cloudflare) to plain HTTP, so its anchor has never actually been read; needs `fetch-protected`/Camoufox. LIVE Jul 14 (submitted 07:10Z, moderation cleared <24h): alternativeto.net/software/weekly-brief/ public logged-out, 5 alternatives attached |
| SaaSHub | https://www.saashub.com | 79 | yes | Free | SUBMITTED (pending ~Aug 8) |
| Peerlist | https://peerlist.io | 77 | no | Free | KILLED Jul 14 (batch B): login + LinkedIn/profile verification gate |
| BetaList | https://betalist.com | 76 | yes | Free | killed (publish is $39 paid-only) |
| Alternative.me | https://alternative.me | 75 | yes | Free | SUBMITTED (pending; re-poll Jul 26 — /weekly-brief, /software/, /apps/ all 404, not in site search → not live yet, no rejection; re-poll ~Aug 5) |
| LaunchIgniter | https://launchigniter.com | 75 | no | Free + Paid | SUBMITTED (pending approval; /product/weekly-brief soft-200 "Product Not Found" on Jul 25 re-poll — still not live 8+ days post-submit; likely silently dropped; re-poll Jul 26 STILL "Product Not Found" 11d post-submit — confirms drop, final re-poll ~Aug 1 then kill) RE-VERIFIED Jul 28 by SITEMAP (not path-guessing): launchigniter.com/sitemap.xml lists 11,882 URLs, zero containing "weekly-brief" — genuinely absent, drop confirmed by positive evidence. **KILLED 2026-08-01** (final poll, Tick 135): sitemap now 2,915 URLs (2,564 `/product/*`) — they pruned their catalogue — still 0 hits for weekly-brief/limed; `/product/weekly-brief` is a 200 soft-404 titled "Product Not Found". Stop polling. |
| PeerPush | https://peerpush.com | 74 | yes | Free + Paid | LIVE Jul 24 (published early, was queued ~Jul 30): peerpush.com/p/weekly-brief HTTP 200 logged-out, 'Launched', FOLLOWED backlink (rel=noopener, no nofollow) to brief.limed.tech — 12th live listing, first live dofollow from DR-74 |
| SoftwareWorld | https://www.softwareworld.co | 73 | yes | Free + Paid | KILLED Jul 14 (batch B): CF bot-verification wall on submit page |
| TinyLaunch | https://www.tinylaunch.com | 72 | yes | Free + Paid | SUBMITTED (launch Aug 10) |
| FoundrList | https://foundrlist.com | 72 | yes | Free | KILLED Jul 14 (batch B): paid-only, no free tier |
| Aura++ | https://auraplusplus.com | 71 | **no** | Free + Paid | LIVE (/projects/weekly-brief) — **NOFOLLOW, audited 2026-08-01**: the single anchor to us carries `rel="noopener nofollow"` (the 5 other brief.limed.tech occurrences are AI-chat deep links + JSON-LD, all valueless). Follow column corrected from yes. Referral value only. |
| Open Launch | https://open-launch.com | 71 | **no** | Free | LIVE Jul 17 — **NOFOLLOW re-confirmed by fetch 2026-08-01**: all 3 anchors to us carry `rel="noopener nofollow"`. Follow column corrected from yes. (/projects/weekly-brief-1062; launch day final 20:06Z: 7th of 15 at 82 upvotes, no top-3 → backlink stays nofollow; badge stays in footer) |
| startupfa.st | https://www.startupfa.st | 71 | no | Free + Paid | badge captured Jul 14 → badge live on all 12 site pages; free-launch job e51221d5 queued |
| SideProjectors | https://www.sideprojectors.com | 70 | yes | Free + Paid | parked Jul 14 (batch B): login works (session saved), but multi-step for-sale marketplace — modest value |
| magicbox.tools | https://magicbox.tools | 70 | yes | Free + Paid | KILLED Jul 14 (batch B): paid-only, no free tier |
| Future Tools | https://www.futuretools.io | 69 | yes | Free | SUBMITTED (manual review ~Jul 24; re-poll Jul 26 futuretools.io/tools/weekly-brief → 404 "Page Not Found", 2d past ETA — not yet published, still in manual review; re-poll ~Aug 2) **Re-polled 2026-08-01 (Tick 135) by SITEMAP: absent** — their sitemap index has 9 children; all 5 `tools-N.xml` = 4,216 tool URLs, 0 hits for weekly-brief/limed; `/tools/weekly-brief` 404. Final re-poll ~Aug 10, then kill. |
| Pitchwall | https://pitchwall.co | 69 | no | Free + Paid | SUBMITTED (under review; re-poll Jul 26 /product|/startup|/p/weekly-brief all 404 — still not live, no rejection mail; re-poll ~Aug 2) **Re-polled 2026-08-01 (Tick 135): absent.** `/sitemap.xml` 404s; robots.txt points to `/sitemaps/products_sitemap.xml` → 501 real `/product/*` slugs, 0 hits for us. All three candidate paths 404. Consistent with owner card `9ddccf47` — our submission is sitting un-submitted-for-review in their dashboard and needs the owner's one click. |
| Tiny Startups | https://tinystartups.com | 69 | yes | Free | APPROVED Jul 14 (badge verified, “cleared to go live”); launches Mon Sep 28 2026 |
| TrustMRR | https://trustmrr.com | 68 | yes | Free | killed Jul 13 (listing requires Stripe key; acquisition marketplace) |
| AiTools | https://aitools.inc | 68 | no | Free + Paid | BLOCKED Jul 14 (batch C): no free form surfaced (likely login/paid wizard) |
| NextGen Tools | https://www.nxgntools.com | 67 | yes | Free + Paid | KILLED Jul 14 (batch B): phone verification required |
| acidtools.com | https://acidtools.com | 66 | yes | Free | KILLED Jul 14 (batch C): paid-only |
| Versily | https://versily.com | 65 | yes | Free | BLOCKED Jul 14 (batch C): auth-gated before any form |
| toolsfine | https://toolsfine.com | 65 | yes | Free | KILLED Jul 14 (batch C): paid-only |
| Startup Stash | https://startupstash.com | 64 | no | Free | SKIPPED Jul 14 (batch C): captcha on submit form — solvable via 2captcha (SaaSHub recipe) but low value, solver spend not warranted; a value call, not a technical wall |
| Openhunts | https://openhunts.com | 63 | yes | Free + Paid | queued (~Jun 2028; no free fast-track) |
| DevHunt | https://devhunt.org | 62 | yes | Free + Paid | killed (every launch week $49, paid-only) |
| Super Launch | https://www.superlaun.ch | 61 | yes | Free + Paid | BLOCKED Jul 14 (batch C): no free form (likely login-gated) |
| Launch Llama Tools | https://tools.launchllama.co | 61 | yes | Free | KILLED Jul 14 (batch C): paid-only |
| MicroLaunch | https://microlaunch.net | 60 | yes | Free | killed (memory) |
| Toolfio | https://toolfio.com | 59 | yes | Free + Paid | skip (DR-5 gate) |
| Indiehunt | https://indiehunt.io | 59 | yes | Free + Paid | KILLED Jul 14 (batch C): paid-only |
| StartupBase | https://startupbase.io | 58 | yes | Free + Paid | engagement-gated (5 upvotes + 3 comments unlock submit; seen Jul 13) |
| Huzzler | https://huzzler.so | 58 | yes | Free + Paid | BLOCKED Jul 14 (batch C): no free form (likely login-gated community) |
| EarlyHunt | https://earlyhunt.com | 57 | yes | Free + Paid | SUBMITTED (scheduled 2027-W11) |
| FridayHunt | https://fridayhunt.com | 57 | **no** | Free + Paid | **NOFOLLOW re-confirmed by fetch 2026-08-01** (`rel="noopener nofollow"`); Follow column corrected from yes. **LIVE (page public) Jul 28 — PRIOR "SILENTLY DROPPED" VERDICT WAS WRONG.** fridayhunt.com/projects/weekly-brief returns HTTP 200 logged-out with our title, tagline and long description; every earlier poll used /product/ and /products/ (both genuinely 404) and concluded the submission was dropped. Found via the bot inbox: FridayHunt mailed "Weekly Brief has been approved for launch" on Jul 24 02:20Z with the /projects/ URL in it. Backlink is rel="noopener nofollow" (NOT dofollow). Listing status still reads "Scheduled" for Fri Jul 17 2026 08:00 UTC — 11 days past its own launch date, so their platform never flipped it; the page is nonetheless publicly indexable. 13th live listing. Re-poll for a launched-state flip (and a possible dofollow upgrade) ~Aug 4. |
| Startups Lab | https://startupslab.site | 55 | yes | Free + Paid | BLOCKED Jul 16: Turnstile at email signup unclickable (closed shadow DOM) on datacenter IP; Google-OAuth alt dead until session re-capture (card 88a4ad07) |
| Firsto | https://firsto.co | 55 | n/a | Free | **NO OUTBOUND LINK TO US TODAY** (fetched 2026-08-01): the listing page is live and is ours, but all 6 brief.limed.tech occurrences are favicon.im image URLs — there is no anchor at all. The dofollow only arrives at launch. SUBMITTED Jul 17 (free lane via 'Earliest available' button; launch Jan 13 2027; listing live at firsto.co/projects/weekly-brief) — footer-badge offer moves launch to Aug 16 2026 + DR-55 dofollow, routed to cto (card 01d861e7) |
| Launch | https://trylaunch.ai | 54 | yes | Free + Paid | LIVE Jul 17 (free lane, GitHub OAuth; trylaunch.ai/launch/weekly-brief — 'Launch complete'; **rel resolved 2026-08-01 (closes qa card 06db1f31): dofollow but JS-only** — Vite SPA, raw HTML carries no anchor; the rendered DOM has 2 links to us, `rel="noopener noreferrer"` (followed). Probable, not banked.) |
| SaasHunt | https://saashunt.best | 53 | yes | Free + Paid | SUBMITTED Jul 18 (free lane, GitHub OAuth; launch scheduled Fri May 7 2027 08:00 UTC; project page ALREADY PUBLIC at saashunt.best/projects/weekly-brief — 2 anchors to brief.limed.tech rel=noopener nofollow pre-launch; submitted by the 03:27Z gtm cycle that TIMED OUT at 30m — work orphaned, tick 72 consumed it) |
| Smol Launch | https://smollaunch.com | ? | **yes** | Free | **LIVE — and one of only 4 banked DOFOLLOW links we have.** Was missing from this master list entirely until 2026-08-01 (it came in via a board card, never got a row), which is why the "14 live listings" total never reconciled. smollaunch.com/products/weekly-brief HTTP 200 logged-out, title "Smol Launch | Weekly Brief", 2 anchors to brief.limed.tech both `rel="noopener noreferrer"` — followed. Verified by fetch 2026-08-01 (Tick 135); first recorded live Jul 21. DR not yet known (not in the launchdirectories scrape). |
| hot100 | https://www.hot100.ai | 52 | yes | Free | LIVE (/project/2167) — **dofollow but JS-only, audited 2026-08-01**: Vite SPA, raw HTML has no anchor at all; the rendered DOM has one `rel="noopener noreferrer"` (followed). Probable, not banked. |
| Launching Next | https://www.launchingnext.com | 52 | yes | Free | SUBMITTED (~4-month queue) |
| AI Tech Viral | https://aitechviral.com | 52 | no | Free | probed Jul 28: no own submit path (homepage submit links point off-site to justlaunched.fyi) — drainer frontier |
| Shipybara | https://shipybara.com | 52 | yes | Free + Paid | probed Jul 25: /submit 404 (no plain-HTTP path); revisit via Camoufox drainer |
| rankinpublic.xyz | https://rankinpublic.xyz | 52 | no | Free + Paid | probed Jul 28: no submit path found on homepage |
| AppaList | https://appalist.com | 51 | yes | Free + Paid | **TIER 2 (session-gated)** — re-measured Jul 31 by the GTM lane: local Camoufox *does* reach the site (the "drainer down" premise was false), but `/submit` is **Google-OAuth-gated** and the bot Google session is EXPIRED. Blocked on owner card `88a4ad07`; do not re-attempt until it is ticked. Dedup clean (0 `weekly-brief` in their sitemap). Dofollow DR-51, worth a launch the moment the session is back. |
| Open Alternative | https://openalternative.co | 51 | yes | Free | probed Jul 25: /submit is login-gated ('Sign In' dominates) + JS-hydrated Next.js; needs Camoufox drainer (down) — no plain-HTTP submit |
| We Like Tools | https://weliketools.com | 50 | no | Free + Paid | probed Jul 28: no own submit path (homepage submit links point off-site to justlaunched.fyi) — drainer frontier |
| StartupTrusted | https://startuptrusted.com | 49 | yes | Free + Paid | probed Jul 25: /submit gated behind 'Sign in with Email' + JS-hydrated Next.js; needs Camoufox drainer (down) |
| IdeaKiln | https://ideakiln.com | 48 | yes | Free | probed Jul 28: no /submit; only /dashboard/submit-idea (auth-gated dashboard, JS-hydrated, forms=0) — needs Camoufox drainer (down) |
| Promote Project | https://www.promoteproject.com | 48 | yes | Free | SUBMITTED (pending review; re-poll Jul 26 still 404 at /startup/ + /product/ — 10+d, no listing → treat as silently dropped; stop polling) RE-VERIFIED Jul 28 by SITEMAP: promoteproject.com/sitemap.xml has 5 URLs, none ours — genuinely absent. Also 13 common listing paths all 404. |
| Micro SaaS Examples | https://www.microsaasexamples.com | 47 | no | Free + Paid | SUBMITTED Jul 28 (plain-HTTP multipart POST to /api/submit, no auth/no captcha — Turnstile code present but inactive; free "standard" tier; category Newsletter; HTTP 202 {"ok":true,"message":"Submission accepted for manual review."}). Manual review, NOT yet live — re-poll ~Aug 5. **Early poll 2026-08-01 (Tick 135): absent** — sitemap 632 URLs (479 `/p/*` product pages), 0 hits; `/p/weekly-brief` 404. Still inside their review window. |
| SaaSBison | https://saasbison.com | 45 | yes | Free + Paid | **SUBMITTED — awaiting moderation.** Jul 31: the reciprocal footer badge is now LIVE on brief.limed.tech (saasbison.com anchor + badge.png, verified by plain HTTP), so their badge gate is satisfied. Public listing still pending: `saasbison.com/product/weekly-brief` 404 and 0 `weekly-brief` in their 423-URL sitemap. **Re-confirmed 2026-08-01 (Tick 135): still not live** — sitemap now 425 URLs (294 `/item/*`), 0 hits; `/item/weekly-brief` is a 200 soft-404 (52KB stub vs 159KB for a real listing like `/item/song-lyrics-review`). **Do not re-submit — status re-check only.** (Earlier note, Jul 25: /submit 200 free tier, JS-hydrated Next.js, paid expedite $12-21.) |
| Proofstories | https://proofstories.io/directory | 43 | yes | Free + Paid | **TIER 3 (new-account-required)** — re-measured Jul 31/Aug 1: `/submit/` returns 200 to plain curl but in a real browser it client-side-redirects to the homepage (reproduced twice; their Next.js payload carries `AuthProvider hasToken:false`). This is **not** a rendering problem and Camoufox alone will not fix it — it needs a new account created, i.e. a CEO/worker-2 gate. Dedup clean. |
| Daily Pings | https://dailypings.com | 43 | yes | Free + Paid | probed Jul 28: /submit 200 but JS-hydrated (forms=0) + sign-in mentions — drainer frontier |
| TinyLaunchpad | https://tinylaunchpad.com | 43 | yes | Free + Paid | probed Jul 28: /projects/submit 200 but JS-hydrated (forms=0) + "Sign in" and $10 tier — drainer frontier |
| Awesome Tools | https://awesome.tools | 42 | no | Free + Paid | probed Jul 28: /submit 200 but empty (forms=0) — drainer frontier |
| FindYourSaaS | https://www.findyoursaas.com | 41 | yes | Free + Paid | probed Jul 28: homepage yields no hrefs (JS-rendered), no /submit path found — drainer frontier |
| ProductBurst | https://productburst.com | 40 | yes | Free | probed Jul 28: homepage yields no hrefs (JS-rendered), no /submit path found — drainer frontier |
| toolfolio | https://toolfolio.io | 39 | no | Free + Paid | probed Jul 28: /submit 200 but empty (forms=0) — drainer frontier |
| Web Review | https://web-review.com | 39 | yes | Free + Paid | probed Jul 28: /submit 200 but empty (forms=0, inputs=0) — no plain-HTTP submit; drainer frontier |
| Saaspa.ge | https://www.saaspa.ge | 39 | yes | Free | probed Jul 28: /submit 200 JS-hydrated (forms=0) + sign-in — drainer frontier |
| DodoDirectory | https://dododirectory.com | 38 | yes | Free + Paid | probed Jul 28: /submit 200 JS-hydrated (forms=0) — drainer frontier |
| BuildVoyage | https://buildvoyage.com | 38 | yes | Free + Paid | probed Jul 28: /submit is a REAL Laravel form (_token, 24 inputs) but gated by Cloudflare TURNSTILE (23 refs, turnstile_blocked input) + sign-in — datacenter IP fails; needs Camoufox drainer (down). Best plain-form candidate once drainer wakes. |
| TechTrendin | https://www.techtrendin.com | 37 | yes | Free | probed Jul 28: no submit path found (homepage has no submit/add/new links) |
| Sumodir | https://sumodir.com | 36 | yes | Free + Paid | probed Jul 28: /submit 200 but empty (forms=0, inputs=0) — drainer frontier |
| ConfettiSaaS | https://confettisaas.com | 36 | yes | Free + Paid | probed Jul 28: /submit 200 but empty (forms=0) — drainer frontier |
| RankYourAI | https://rankyourai.com | 35 | yes | Free | probed Jul 28: /p/submit/ 200 JS-hydrated (forms=0) — drainer frontier |
| launch.cab | https://launch.cab | 34 | yes | Free | probed Jul 28: /submit 200 but empty (forms=0) — drainer frontier |
| aat.ee | https://www.aat.ee | 34 | yes | Free + Paid | probed Jul 28: /projects/submit 200 JS-hydrated + 22 auth mentions — login-gated; drainer frontier |
| Made with Lovable | https://madewithlovable.com | 33 | yes | Free | probed Jul 28: no submit path (Lovable-built-products directory — Weekly Brief is not Lovable-built; eligibility mismatch, not a technical wall) |
| ShipYard HQ | https://shipyardhq.dev | 33 | yes | Free + Paid | probed Jul 28: no plain submit form; auth-gated (7 sign-in mentions) — drainer frontier |
| Best of Web | https://www.bestofweb.site | 32 | yes | Free | probed Jul 28: /submit 200 but empty (forms=0) — drainer frontier |
| LLM Relevance | https://llmrelevance.com | 31 | yes | Free | probed Jul 28: no own submit path found (homepage submit links point off-site) — drainer frontier |
| Resource.fyi | https://resource.fyi | 31 | yes | Free | probed Jul 28: /submit, /submit-resource, /add all return the SAME soft-200 catch-all (SPA fallback) — no real submit route |
| Builtbyindies | https://builtbyindies.com | 30 | yes | Free + Paid | probed Jul 28: /submit 200 but empty (forms=0) — drainer frontier |
| Stellar Launch | https://stellarlaunch.org | 30 | no | Free + Paid | probed Jul 28: no own submit path (homepage links go off-site) — drainer frontier |
| IndieHackerStacks | https://indiehackerstacks.com | 30 | yes | Free | probed Jul 28: only a newsletter form; no product-submit path found — drainer frontier |
| HUNT0 | https://hunt0.com | 29 | yes | Free + Paid | probed Jul 28: /submit renders a full React form (21 inputs, free tier checked / paid disabled) but inputs have NO name attrs (client-side POST to an API) + captcha + sign-in — no plain-HTTP submit; drainer frontier |
| AwesomeIndie | https://awesomeindie.com | 28 | no | Free | SUBMITTED (pending; re-poll Jul 26 — /weekly-brief, /products/, /apps/, /indie/ all 404, not on homepage → not live yet; re-poll ~Aug 5) |
| Bulletin | https://bulletin.so | 27 | yes | Free | probed Jul 28: DOWN — curl HTTP 000 (connection/TLS failure) on https://bulletin.so |
| SaaSGrow | https://saasgrow.app | 26 | yes | Free + Paid | probed Jul 28: /submit 200 JS-hydrated (forms=0) + sign-in — drainer frontier |
| EuroAlternative | https://euroalternative.co | 26 | yes | Free | probed Jul 28: /submit 200 but JS-hydrated (forms=1/inputs=2 only) + 31 auth mentions — login-gated; drainer frontier |
| startuups | https://startuups.com | 26 | yes | Free + Paid | probed Jul 28: /projects/submit 200 JS-hydrated (forms=1/inputs=1) + sign-in — drainer frontier |
| ProductLaunchpad | https://productlaunchpad.app | 23 | yes | Free | probed Jul 28: /submit 200 JS-hydrated (forms=1/inputs=2) + 20 auth mentions — login-gated; drainer frontier |
| Justgotfound | https://justgotfound.com | 20 | yes | Free | site down/TLS-broken (seen Jul 13) |
| madewithbolt | https://madewithbolt.com | 20 | no | Free | KILLED Jul 28: real plain-HTTP Laravel POST form at /submit-project (no auth, no captcha) BUT "Only projects built with Bolt will be accepted" — Weekly Brief is not Bolt-built; ineligible, submitting would be a fabricated fit |
| Launch Vibe | https://www.launchvibe.app | 12 | yes | Free | probed Jul 28: /submit 200 but empty (forms=0) — drainer frontier |
| Launchy.tools | https://launchy.tools | 7 | yes | Free + Paid | probed Jul 28: homepage 200 but no submit form/path surfaced — drainer frontier |

## Paid-only (21) — money gate, do NOT submit without approval
| Directory | URL | DR | Follow | Pricing | Status (WeeklyBrief) |
|---|---|--:|:--:|---|---|
| TechCrunch | https://techcrunch.com | 92 | no | Paid | paid editorial |
| StartupFA.me | https://startupfa.me | 83 | yes | Paid | LIVE Jul 14 — /s/weekly-brief public logged-out, 3 brief.limed.tech anchors NO rel (followed); verifier PASS |
| Turbo0 | https://turbo0.com/?via=launchdirectories | 80 | **no** | Paid | LIVE via free lane (/item/weekly-brief) — **NOFOLLOW, audited 2026-08-01**: all 3 anchors to us carry `rel="nofollow noopener noreferrer"`. Follow column corrected from yes; our highest-DR live listing passes nothing. |
| Toolpilot | https://www.toolpilot.ai | 78 | yes | Paid | probed Jul 28 (deep): FREE LANE EXISTS but not plain-HTTP submittable. Page states "A link back to our site is now mandatory for all free listings... add one of our badges... then fill in the URL or email us to confirm." Shopify store; the submission form + pricing table are JS-rendered (static HTML has only /contact, /localization and /search forms) — needs a rendered browser (drainer frontier). Tier label "Paid" is WRONG: free badge-swap lane confirmed in their own copy. Paid extras $6/$9/$50. |
| There's An AI For That | https://theresanaiforthat.com/?via=krzysztof | 77 | yes | Paid | probed Jul 28: homepage returns HTTP 403 to plain HTTP (bot wall) — unreadable without a real browser. Drainer frontier; tier unverified by us. |
| SubmitAiTools | https://submitaitools.org | 75 | no | Paid | **SUBMITTED Jul 28 (free tier, $0)** — MISCLASSIFIED as paid-only. /submit-your-ai-tool/ 302s to /verify/submit/, a colour-choice human check ("click the button with the X color", colour randomised per session); POST choice=<colour> with the Django CSRF token sets a sessionid and unlocks the real page. That page carries 4 submit forms: 3 paid (tarefe_id 5/3/10 -> PayPal/crypto/card, $49-$199) and 1 FREE with no tarefe_id and button "Send Tool", priced in their own table as "Free listing $0/one-time". Free terms: their badge must be on our home page or footer ("as long as the link remains live on your website, your link will also stay listed"), review up to 5 business days. OUR HALF DONE FIRST: badge shipped + verified live on all 12 brief.limed.tech pages BEFORE submitting. Submitted multipart POST (title/content/email/website/pricing_model=2 Freemium/apps=1 Web App/newsletter) -> HTTP 302 POST-redirect-GET, no validation errors re-rendered. **LIVE since ~Jul 29** — https://submitaitools.org/brief-limed-tech/ , 200 logged-out, title "Weekly Brief Review, Pricing, Features & Alternatives", 6 mentions of brief.limed.tech, screenshot asset hosted. **The one outbound anchor is `rel="nofollow noopener"` — this listing passes NO authority** (re-verified Tick 135, 2026-08-01). Their confirmation mail sat unread in our inbox for 2 days, which is why we found out late. |
| Uneed | https://www.uneed.best?atp=pBmSdT | 75 | yes | Paid | SUBMITTED-VERIFIED via free waiting line (launch Nov 30) |
| Indie Deals | https://www.indie.deals | 60 | yes | Paid | SUBMITTED free (still not public Jul 25 re-poll — /deals/weekly-brief serves catch-all homepage, not a listing; well past their ~96h estimate; badge stays in footer — re-poll ~Aug 1) RE-VERIFIED Jul 28 by SITEMAP: indie.deals/sitemap.xml has 204 URLs, none containing "weekly-brief" — genuinely not published (their catch-all homepage is why /deals/weekly-brief looked like a 200). **Re-polled 2026-08-01 (Tick 135): still absent** — 204 URLs incl. 147 real `/item/*` listings, 0 hits; `/deals/weekly-brief` now redirects to `/item/weekly-brief` which 200s with a "does not exist" body. 14 days post-submit → treat as dropped, stop polling. |
| aiwith.me | https://aiwith.me | 59 | yes | Paid | probed Jul 28: /submit 200, single form, 3 inputs, no captcha, but sign-in words + a price ladder ($8-$39) on page — paid/auth lane, not free-submittable over plain HTTP. |
| SoloPush | https://solopush.com | 45 | yes | Paid | killed-for-now (backend NXDOMAIN) |
| AiTools | https://aitools.fyi | 44 | yes | Paid | probed Jul 28: /submit is a Tally form (form 2EkV4g, "Boost My Tool Submission") with NO captcha and NO auth, but its final block is a REQUIRED PAYMENT ("Submission Fee") — genuinely paid, tier classification correct. KILLED for the free lane (money gate). |
| Startups.fm | https://startups.fm | 42 | yes | Paid | **SUBMITTED Jul 28 (free tier)** — MISCLASSIFIED as paid-only: /submit is "one quick form, no account needed", free lane = £0. Plain-HTTP POST to /api/submit (no auth, no captcha) returned {"ok":true,"submissionId":"a746bbcc-882e-4a53-8299-60e2d6657b06","slug":"weekly-brief"}; did NOT call /api/submit/plan (that is the paid skip-the-queue upsell). Free terms: NOFOLLOW link + Startups.fm badge required on our site to stay listed (badge SVG served at /badge/weekly-brief — NOTE: that endpoint renders for any slug, so it is NOT proof the listing exists; the only evidence is the API acknowledgment above). Listing not public yet (review queue) — re-poll ~Aug 4, then ship the badge with the real listing URL. **Early poll 2026-08-01 (Tick 135): not live yet, as expected** — sitemap 2,459 URLs (2,306 `/startups/*`), 0 hits; `/weekly-brief` and `/startups/weekly-brief` both 404. Note their free lane is NOFOLLOW by their own terms, so this listing will not move position even once it lands. |
| startuplist.ing | https://startuplist.ing | 41 | yes | Paid | probed Jul 28: no submit route in their sitemap (categories/tags/builders/deals only) and the only submission-shaped homepage link is the third-party paid service submitmysaas.com. No free self-serve lane found over plain HTTP. |
| IndieHub | https://indiehub.best | 39 | no | Paid | probed Jul 28: /submit 200 but 25 auth references and zero "free" mentions, prices $10/$14 — login + paid. Not free-submittable. |
| 1000.tools | https://1000.tools | 38 | no | Paid | probed Jul 28: no submit route in sitemap or homepage (only /waitlist, /itemlist and category pages). No self-serve submission lane found. |
| SubmitHunt | https://www.submithunt.com | 36 | yes | Paid | blocked (Google-only login; bot Google session dead — card 88a4ad07) |
| Startups.fyi | https://startups.fyi | 30 | yes | Paid | probed Jul 28: sitemap has /product/<slug> listing pages but NO submit route; the only submission-shaped homepage link is /sponsor (paid placement). No free lane found. |
| ToolHub | https://toolhub.me | 26 | yes | Paid | probed Jul 28: /pages/submit/ pricing table is Basic $3 / Featured $10 one-time, both paid ("Choose a listing type to continue"); dofollow only on the $10 tier. Genuinely paid — tier label correct. KILLED for the free lane (money gate). |
| Toollist | https://toollist.ai | 25 | yes | Paid | probed Jul 28: /submit-tool 200, auth-gated, prices $29/$47/$99/$249 — paid. Not free-submittable. |
| Saassy Board | https://saassy-board.com | 21 | yes | Paid | probed Jul 28: no sitemap.xml, no submit/add/list route responding 200, no submission-shaped link on the homepage. No lane found over plain HTTP. |
| Postioo | https://postioo.com | 7 | yes | Paid | probed Jul 28: /submit 200 but JS-rendered (form element with 0 static inputs); price ladder present — needs a rendered browser to even read the form. Drainer frontier. |

## How to re-scrape (next time)
```bash
curl -fsS -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36" \
  https://launchdirectories.com -o /tmp/ld.html
python3 - <<'PY2'
import re,json
b=''.join(re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)',open('/tmp/ld.html').read(),re.S))
b=b.encode().decode('unicode_escape','ignore')
i=b.find('"initialDirectories":'); s=b.find('[',i); d=0
for j in range(s,len(b)):
    d+= b[j]=='['; d-= b[j]==']'
    if d==0: e=j+1; break
json.dump(json.loads(b[s:e]),open('/tmp/ld-directories.json','w'),indent=2)
PY2
```
Fields per directory: name, url, slug, domainRating, mozDA, monthlyTraffic, dofollow,
category (Free / Free + Paid / Paid), tags, upvotes/voteScore, screenshotUrl, longDescription.
(`listingType`, `submissionFee`, `approvalTime` come through as null/$undefined — use `category` for pricing.)

## Rules (from tools/directories.md)
- Free listings only by default; any Paid = money gate → approval + Hundred-Dollar Test.
- Prefer **dofollow** for backlink value; DR is Ahrefs authority (higher = stronger SEO signal).
- Submitting is outbound publication but PRE-AUTHORIZED under the bot identity (boseclaw) — do it, don't ask.
- The real wall is Turnstile/hCaptcha/reCAPTCHA at *signup*, not logins — datacenter IP fails image grids;
  residential homelab TRAWL improves odds. OAuth-only dirs need the boseclaw Google/GitHub profile.
- Never fabricate traction numbers on a form; use measured or omit.

---

## Second-source scrape — startupsubmit.app + ideaproof.io (2026-07-30, gtm lane)

**Why:** this master list came from ONE aggregator (launchdirectories.com). Both tiers were
finished by ticks 121/122, and the lane started calling the whole directory frontier exhausted —
the same over-generalisation `private/memory/partial-probe-is-not-exhaustion.md` was written
about. `tools/gtm-sources.md` names two aggregators that had NEVER been scraped. Scraped both.

**Sources:**
- `https://startupsubmit.app/best-startup-directories` — HTTP 200, free list = **15** directories
  (their paid service claims a 220+/300+ DB; the rest is behind a $99 gate, not readable).
  11 of the 15 were already classified here. **4 were new to us.**
- `https://ideaproof.io/tools/category/launch-directories` — HTTP 200 but **DUD SOURCE**: the URL
  resolves to IdeaProof's own marketing page (their pricing/FAQ/testimonials), no directory
  listing of any kind. Do not re-scrape; drop it from `tools/gtm-sources.md`.

**The 4 new directories, all probed by plain HTTP this cycle. None is free-submittable by us.**

| Directory | URL | DR | Follow | Pricing | Status (WeeklyBrief) |
|---|---|--:|:--:|---|---|
| Trustpilot | https://business.trustpilot.com | 92 | — | Free tier | NOT SUBMITTED — genuine free lane ("Create Your Free Account", "at no cost to get started", and their own pitch is GEO: "Improve how your business appears in AI answers and search results"). Blocked on ACCOUNT CREATION: signup form is JS-rendered (0 static inputs in SSR) + email verification. Account creation is worker-2 gated regardless of owner approval → routed to CEO, not attempted. Best new candidate by far. |
| Crunchbase | https://www.crunchbase.com | 91 | — | Free | NOT SUBMITTED — boseclaw account already EXISTS (created Jul 12 for DinnerElite) but Crunchbase will not accept a company until the account is "enabled for contributions" (needs a social-profile link + ~1 business day manual review). Same account gates weeklybrief. Already boarded as card e6e98a01 (human, optional). |
| F6S | https://www.f6s.com | 72 | — | Free | DRAINER-GATED — hard bot wall: HTTP **405** to every path tried (`/`, `/signup`, `/join`, `/company/signup`, `/startups`) with browser UA + Accept headers; body is a `<title>Checking your browser</title>` interstitial carrying `captcha-challenge=1`. `/sitemap.xml` 400. Nothing readable over plain HTTP; needs Camoufox/TRAWL (homelab worker down ~290h). |
| Futurepedia | https://www.futurepedia.io | 72 | — | **Paid only** | **KILLED — money gate, far over the Hundred-Dollar Test.** `/submit-tool` HTTP 200 and fully readable: the only two lanes are Basic **$247** (marked *Sold Out*) and Verified **$497** one-time, plus custom-priced Enterprise. No free lane anywhere on the page; the "Do you offer free listings?" FAQ body is not server-rendered. Not staged as a PENDING — $247 is not a $100-test call worth the owner's attention. Dedup checked first: `/tool/weekly-brief` 404. |

**Net:** the directory frontier is genuinely wider than this list recorded — but every newly-found
row is gated on account-creation, a bot wall, or money. Zero new drainer-free submissions exist.
That is now positive evidence, not an assumption from a sample.
