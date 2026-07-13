// startupranking.mjs — Weekly Brief flow for StartupRanking (startupranking.com).
//
// The whole site sits behind a Cloudflare "Just a moment…" managed challenge that fires on
// EVERY navigation (GETs and form POSTs alike). Camoufox's real Firefox fingerprint clears it
// automatically, but it takes ~10-18s each time — so this flow waits generously after every
// goto / submit and re-checks it's past the interstitial. Login is social-only (no email/pw);
// we use Google OAuth (boseclaw, pre-authorized). The listing is a multi-step create:
//   /login (Google) → /startup/create/url-validation (validate URL → Continue) →
//   /startup/create?url=… (full form) → SUBMIT STARTUP → profile (pending moderation).
// FREE only — StartupRanking has no paywall on the basic listing (SR Booster/Advertising are
// separate upsells we never touch). Proven 2026-07-07.
export const meta = {
  directory: "startupranking",
  home: "https://www.startupranking.com",
  submitUrl: "https://www.startupranking.com/startup/create/url-validation",
};

// Cloudflare on this site needs a real, longish clear. Reload once if still interstitial.
async function clearCf(H, tries = 3) {
  for (let i = 0; i < tries; i++) {
    await H.wait(i === 0 ? 12000 : 8000);
    const t = (await H.text()).slice(0, 400);
    if (!/Just a moment|Performing security verification|verify you are (not )?a bot/i.test(t)) return true;
    await H.page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  }
  return false;
}

export default async function launch({ H, kit }) {
  const listingUrl = `${meta.home}/startup/${kit.slug}`;

  // ---- dedup: does the listing page already exist? (don't duplicate) ----
  await H.goto(listingUrl);
  await clearCf(H);
  const existing = await H.text();
  if (new RegExp(kit.name, "i").test(existing) && /Website:|Founded:|SR Score|approval team/i.test(existing)) {
    return { status: "already-live", listingUrl, notes: "listing already live on StartupRanking — verified, not duplicated" };
  }

  // ---- ensure logged in via Google OAuth (social-only login) ----
  await H.goto("https://www.startupranking.com/user/bose-claw");
  await clearCf(H);
  const loggedIn = /Log ?out|Communication Preferences/i.test(await H.text());
  if (!loggedIn) {
    await H.goto("https://www.startupranking.com/connect/google");
    await H.wait(22000);                                  // connect endpoint runs a slower CF check
    await H.clickIf("text=Bose Claw", 10000); await H.wait(8000);
    await H.clickIf("text=Continue", 10000); await H.wait(10000);   // OAuth consent, if shown
  }

  // ---- step 1: validate the startup URL ----
  await H.goto(meta.submitUrl);
  await clearCf(H);
  await H.waitFor("#startup_url_input", 15000);
  await H.fill("#startup_url_input", kit.url);
  await H.click("#statup_validate_button");               // note: site's own id typo
  await H.wait(16000);                                    // validate re-navigates → CF challenge
  await clearCf(H);
  await H.waitFor("a.btn-green", 15000);                  // "Continue" link appears when URL is valid
  await H.click("a.btn-green");
  await H.wait(16000);
  await clearCf(H);

  // ---- step 2: the full create form ----
  await H.waitFor("#startup_name", 15000);
  await H.fill("#startup_name", kit.name);
  await H.fill("#startup_phrase", kit.tagline);           // slogan, ≤60 chars
  await H.select("#startup_countryCode", "FR");           // maker is France-based
  await H.wait(6000);                                     // country change AJAX-loads the state list
  await H.select("#startup_state", "1187");               // Paris
  await H.select("#startup_foundingDate_month", "1");
  await H.select("#startup_foundingDate_day", "1");
  await H.select("#startup_foundingDate_year", "2026");
  await H.select("#startup_businessTypeCode", "BC");      // B2C
  await H.select("#startup_industryTypeCode", "SI");      // Software, Internet & Computer Services
  // #startup_url is readonly + already prefilled from step 1 — leave it.
  await H.fill("#startup_description", kit.description);   // ≥300 chars; "ranks, does not summarize"
  await H.fill("#startup_email", "boseclaw@gmail.com");   // real inbox we control (for any verification)
  await H.wait(1500);
  await H.shot("form-filled");

  // ---- submit ----
  await H.click("button:has-text('SUBMIT STARTUP')");
  await H.wait(16000);                                    // submit re-navigates → CF challenge
  await clearCf(H);

  const url = H.url();
  const body = await H.text();
  // validation bounced us back to the create form → report what failed
  if (/\/startup\/create/.test(url) && /required|at least 300|invalid|error/i.test(body)) {
    return { status: "failed", listingUrl: null, notes: `form validation error; still at ${url}` };
  }
  // success lands on /startup/claim/<slug> (optional ownership claim). The public listing is
  // /startup/<slug> and is live immediately, pending moderation.
  if (/\/startup\/claim\//.test(url) || /pending|review|moderation|thank|success|submitted|registered|congratulat/i.test(body)) {
    return { status: "submitted", listingUrl, notes: "registered & live, pending StartupRanking approval; optional ownership-claim (HTML file / tweet / domain email) not done" };
  }
  return { status: "submitted", listingUrl, notes: `submit clicked, no explicit error; verify on audit. at ${url}` };
}
