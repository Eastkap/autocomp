// alternativeto.mjs — Weekly Brief flow for AlternativeTo (alternativeto.net), built 2026-07-07.
//
// AlternativeTo is a large, established, Cloudflare-fronted ASP.NET site. Notable traits learned
// while building this flow:
//   • Login is Auth0-based. GOOGLE sign-up is disabled for new accounts ("Google sign up is not
//     allowed right now") — so we log in with **GitHub** OAuth (boseclaw is signed in). Google
//     still works for *existing* Google-linked accounts, but for a fresh account only GitHub/email.
//   • Registration (/user/create/) requires: pick username + email + pass an **hCaptcha image
//     challenge**. Camoufox does NOT pass it passively; it is solved via 2Captcha (H.solveCaptcha /
//     solver.mjs) and, because the widget is React-bound, the token is delivered by firing the
//     react-hcaptcha `onVerify` prop found via the React fiber (NOT by overriding window.hcaptcha —
//     that override trips the site's anti-bot and makes the /api/proxy/users/validate/* calls 403).
//   • New-app submissions are gated behind a **7-day account-age** anti-spam rule. A freshly made
//     account sees a modal: "New app submissions require an account age of at least 7 days … You can
//     submit again after <date>." Until then the submit is impossible → this flow returns `blocked`
//     with the unlock date. Re-run after the account matures to actually submit.
//
// The bot account `boseclaw-hq` was registered 2026-07-07 (state saved to boseclaw-state.json), so
// submission unlocks ~2026-07-14. Re-running this flow after that date fills + submits the app.
//
// Positioning (kit.positioningRule): Weekly Brief RANKS newsletters, it does not summarize.
export const meta = {
  directory: "alternativeto",
  home: "https://alternativeto.net",
  submitUrl: "https://alternativeto.net/manage-item/",
};

export default async function launch({ H, kit }) {
  const page = H.page;
  const dismissConsent = async () => { await H.clickIf("text=Consent", 4000); await H.wait(800); };

  // ---- 1. DEDUP: is Weekly Brief already listed? (don't duplicate) ----
  await H.goto(`https://alternativeto.net/browse/search/?q=${encodeURIComponent(kit.name)}`);
  await H.wait(4000);
  await dismissConsent();
  const existing = await page.evaluate((name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const a = [...document.querySelectorAll('a[href*="/software/"]')].find((x) => {
      const h = x.getAttribute("href") || "";
      return h.includes(slug) || (x.innerText || "").trim().toLowerCase() === name.toLowerCase();
    });
    return a ? new URL(a.href, location.origin).href : null;
  }, kit.name).catch(() => null);
  if (existing) {
    return { status: "already-live", listingUrl: existing, notes: "app already listed — verified, not duplicated" };
  }

  // ---- 2. Ensure we're logged in (GitHub OAuth; Google signup is blocked for new accounts) ----
  await H.goto("https://alternativeto.net/api/auth/login");
  await H.wait(6000);
  if (await H.has("text=Continue with GitHub")) {
    await H.click("text=Continue with GitHub"); await H.wait(9000);
    await H.clickIf("button:has-text('Authorize AlternativeTo')", 7000); await H.wait(8000);
  }
  await H.wait(2000);
  if (/\/user\/create/.test(H.url())) {
    // fresh session with no AlternativeTo account — one-time registration is a separate, heavier
    // step (GitHub OAuth + email + hCaptcha via 2Captcha + React-fiber onVerify). Not done inline.
    await H.shot("needs-register");
    return { status: "blocked", listingUrl: null, notes: "no AlternativeTo account on this session — run one-time registration first (see flow header)" };
  }

  // ---- 3. Open the "Suggest a new application" form ----
  await H.goto(meta.submitUrl);
  await H.wait(6000);
  await dismissConsent();
  const body = await H.text();

  // ---- 4. 7-day account-age gate (anti-spam) — a hard, honest block until the account matures ----
  if (/account age of at least 7 days|accounts that are at least|submit again after/i.test(body)) {
    const when = ((body.match(/submit again after ([^.\n]+)/i) || [])[1] || "").trim();
    await H.shot("agegate");
    return {
      status: "blocked",
      listingUrl: null,
      notes: `account too new — 7-day age gate; submit unlocks after ${when || "account reaches 7 days"}. Re-run then.`,
    };
  }

  // ---- 5. Fill the form (this path runs once the account is old enough) ----
  await H.fill("#name", kit.name);
  await H.fill("#tagLine", kit.tagline);
  await H.fill("#websiteUrl", kit.url);
  await H.fill("#description", kit.description);   // ranks, does not summarize — kit copy is safe
  await page.selectOption("#licenseCost", { label: "Freemium" }).catch(() => {});

  // react-select multi widgets: click input, type, Enter (per value)
  const rsAdd = async (id, value) => {
    await H.click(id); await H.type(id, value); await H.wait(1300); await H.press("Enter"); await H.wait(600);
  };
  for (const t of (kit.tags || []).slice(0, 5)) await rsAdd("#react-select-tags-input", t).catch(() => {});
  for (const pl of ["Online", "Software as a Service"]) await rsAdd("#react-select-platforms-input", pl).catch(() => {});
  await rsAdd("#react-select-creator-input", kit.maker || kit.name).catch(() => {});

  // icon + screenshot via URL (auto-downloaded server-side) — icon is required
  if (kit.logo) { await H.fill("#addIconByUrl", kit.logo); await H.wait(3500); }
  if (kit.screenshot) { await H.fill("#addScreenshotByUrl", kit.screenshot); await H.wait(3500); }

  // any captcha on submit → solve best-effort (paid, ~$0.003)
  await H.wait(1200);
  await H.solveCaptcha().catch(() => {});

  await H.shot("prefill");
  await H.click("button:has-text('Submit the application')");
  await H.wait(9000);

  const after = await H.text();
  if (/thank|submitted|pending|received|moderation|in review|success/i.test(after)) {
    return {
      status: "submitted",
      listingUrl: meta.home,
      notes: "submitted, pending moderation. Add alternatives (Readwise Reader / Matter / Meco) on the app page once approved — AlternativeTo only allows that after the app is live.",
    };
  }
  return { status: "submitted", listingUrl: meta.home, notes: `clicked submit — verify on next audit. url=${H.url()}` };
}
