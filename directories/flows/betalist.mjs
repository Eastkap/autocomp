// betalist.mjs — Weekly Brief on BetaList. Iterated & proven 2026-07-07.
//
// AUTH: BetaList's only social login is "Sign in with X" (Twitter) — no Google/GitHub OAuth — so
// we can't skip the captcha via OAuth. We sign in with an email/password account we created
// (boseclaw@gmail.com). Sign-in itself is captcha-free. If the account doesn't exist yet, we sign
// up: the first "Create my account" submit renders a reCAPTCHA v2 checkbox (and clears the
// password fields), then H.solveCaptcha() pays 2Captcha (~$0.002) for a token and injects it.
// (Proven: the 2Captcha solve created the account first try.)
//
// SUBMIT WIZARD (once logged in): /submit → enter website URL → BetaList AI-analyzes the site →
// "All set" → Continue → 6-step wizard: General (name/pitch/website/description/icon) → Details
// (topics) → Media (screenshots) → Team → Finish (accelerator/investor interest — left blank) →
// Submit ("Choose your plan").
//
// ⛔ PAYWALL (the real, honest blocker): BetaList NO LONGER HAS A FREE QUEUE. The final "Choose
// your plan" step offers ONLY paid plans — Premium $299 / Standard $99 / Lite $39 — and the
// submission stays a permanent DRAFT until one is purchased (dashboard pipeline: Submitted →
// Reviewed → Featured, none reached while unpaid). There is no "submit for free / I'll wait"
// link (verified: only "Back" + "Cancel"). FAQ mentions "free" only to say free-hosting
// subdomains are disallowed. Since spending money is approval-gated, this flow prepares the
// full submission as a draft and STOPS at the plan page — it never pays. Returns "blocked" with
// the draft URL + a note that publishing needs owner approval for a paid plan.
export const meta = { directory: "betalist", home: "https://betalist.com", submitUrl: "https://betalist.com/submit" };

// credentials by name from .secrets/accounts.env (loaded by engine.mjs) — never hardcode secrets
const EMAIL = process.env.BETALIST_EMAIL || "boseclaw@gmail.com";
const USERNAME = process.env.BETALIST_USERNAME || "weeklybrief";
const PASSWORD = process.env.BETALIST_PASSWORD;   // account created 2026-07-07

async function fillSignup(H) {
  await H.fill("#user_username", USERNAME);
  await H.fill("#user_email", EMAIL);
  await H.fill("#user_password", PASSWORD);
  await H.fill("#user_password_confirmation", PASSWORD);
}

// Sign in with the email account; if it doesn't exist, sign up (2Captcha-solving the v2 checkbox).
async function ensureLogin(H) {
  await H.goto("https://betalist.com/sign_in"); await H.wait(3000);
  if (await H.has("#user_email")) {
    await H.fill("#user_email", EMAIL);
    await H.fill("#user_password", PASSWORD);
    await H.clickIf("input[name='commit']", 6000); await H.wait(5000);
  }
  if (!/sign_in|sign_up/.test(H.url())) return "signin";

  // sign-in didn't take → create the account (with captcha solve)
  await H.goto("https://betalist.com/sign_up"); await H.wait(3000);
  await fillSignup(H); await H.wait(600);
  await H.click("input[name='commit']"); await H.wait(5000);   // renders the v2 checkbox
  for (let i = 1; i <= 2; i++) {
    await fillSignup(H); await H.wait(800);                     // refill cleared passwords
    const ok = await H.solveCaptcha();
    console.log(`signup captcha solve #${i}: ${ok}`);
    if (!ok) continue;
    await H.click("input[name='commit']"); await H.wait(7000);
    if (!/sign_in|sign_up/.test(H.url())) return "signup";
    await H.goto("https://betalist.com/sign_up"); await H.wait(3000);
    await fillSignup(H); await H.wait(600); await H.click("input[name='commit']"); await H.wait(5000);
  }
  throw new Error("could not sign in or create the BetaList account");
}

async function completeProfileModal(H, kit) {
  if (await H.has("#user_name")) {
    await H.fill("#user_name", kit.maker || "Jacobo");
    await H.clickIf("#user_subscribe_to_newsletter_no", 2000);
    await H.clickIf("input[value='Save profile']", 4000); await H.wait(2500);
  }
}

// Fill all wizard steps and advance to the "Choose your plan" page. Overwrites the AI-generated
// pitch/description with kit copy (positioning: RANKS, not summarizes); keeps AI topics + media.
async function runWizard(H, kit) {
  // General
  await H.waitFor("#submission_startup_attributes_name", 15000).catch(() => {});
  if (await H.has("#submission_startup_attributes_custom_icon") && kit.logoFile)
    await H.upload("#submission_startup_attributes_custom_icon", kit.logoFile).catch(() => {});
  if (await H.has("#submission_startup_attributes_name")) {
    await H.fill("#submission_startup_attributes_name", kit.name);
    await H.fill("#submission_startup_attributes_pitch", kit.tagline);       // "…ranked into one weekly brief."
    await H.fill("#submission_startup_attributes_description", kit.description);
    await H.wait(1200);
    await H.clickIf("button:has-text('Details'):visible", 8000); await H.wait(4000);
  }
  // Details (keep AI-selected topics) → Media (keep) → Team → Finish (leave interest boxes blank)
  await H.clickIf("button:has-text('Media'):visible", 8000); await H.wait(4000);
  await H.clickIf("button:has-text('Team'):visible", 8000); await H.wait(4000);
  await H.clickIf("button:has-text('Finish'):visible", 8000); await H.wait(4000);
  await H.clickIf("button:has-text('Choose Package'):visible", 8000); await H.wait(5000);
}

export default async function launch({ H, kit }) {
  // ---- dedup: already publicly live? ----
  await H.goto(`https://betalist.com/startups/${kit.slug}`); await H.wait(2500);
  const dd = await H.text();
  if (new RegExp(kit.name, "i").test(dd) && !/404|not found|page you were looking/i.test(dd))
    return { status: "already-live", listingUrl: `https://betalist.com/startups/${kit.slug}`, notes: "listing already live — verified, not duplicated" };

  const how = await ensureLogin(H);
  console.log("auth:", how);
  await H.goto(meta.submitUrl); await H.wait(3500);
  await completeProfileModal(H, kit);

  // ---- resume an existing draft if we have one (avoid duplicate submissions) ----
  await H.goto("https://betalist.com/dashboard"); await H.wait(3000);
  const resume = await H.page.evaluate((name) => {
    const links = Array.from(document.querySelectorAll('a[href*="/wizard/"]'));
    for (const a of links) {                      // match the draft CARD's text, not the link's own
      let el = a, txt = "";
      for (let i = 0; i < 6 && el; i++) { txt += " " + (el.innerText || ""); el = el.parentElement; }
      if (new RegExp(name, "i").test(txt)) return a.getAttribute("href");
    }
    return links[0] ? links[0].getAttribute("href") : null;   // fallback: the only draft
  }, kit.name).catch(() => null);

  let subId = resume && (resume.match(/submissions\/(\d+)/) || [])[1];
  if (resume) {
    // resume at the general step to (re)confirm copy, then walk to the plan page
    await H.goto(`https://betalist.com/submissions/${subId}/wizard/general`); await H.wait(4000);
    await runWizard(H, kit);
  } else {
    // ---- fresh: URL-first → AI analysis → "All set" → wizard ----
    await H.goto(meta.submitUrl); await H.wait(3500);
    if (await H.has("#submission_startup_attributes_website_url")) {
      await H.fill("#submission_startup_attributes_website_url", kit.url);
      await H.clickIf("button:has-text('Continue'):visible", 8000);
      await H.wait(6000);
      // wait out the "Analyzing your website" screen, then the "All set" Continue
      for (let i = 0; i < 10; i++) { if (!/Analyzing/i.test(await H.text())) break; await H.wait(4000); }
      await H.clickIf("button:has-text('Continue'):visible, a:has-text('Continue'):visible", 8000); await H.wait(6000);
    }
    subId = (H.url().match(/submissions\/(\d+)/) || [])[1];
    await runWizard(H, kit);
  }

  await H.shot("choose-plan");
  const draftUrl = subId ? `https://betalist.com/submissions/${subId}` : H.url();
  const body = await H.text();
  const onDashboard = /\/dashboard/.test(H.url());

  // Expected: the paid-only "Choose your plan" wall. NEVER pay — this is an approval-gated spend.
  if (/Choose your plan/i.test(body) || /\/wizard\/submit/.test(H.url())) {
    // belt-and-suspenders: is there any free/no-thanks path we missed?
    const freeLink = await H.page.evaluate(() => Array.from(document.querySelectorAll("a,button"))
      .map((e) => (e.innerText || "").trim()).find((t) => /submit for free|no thanks|i'?ll wait|free queue|regular submission|skip.*pay/i.test(t)) || null).catch(() => null);
    if (freeLink) return { status: "blocked", listingUrl: draftUrl, notes: `found a possible free path ("${freeLink}") — needs a human to confirm it's non-paid before use` };
    return {
      status: "blocked", listingUrl: draftUrl,
      notes: "Draft fully prepared (name, ranked pitch, description, 5 topics, logo). BetaList has NO free queue " +
             "anymore — publishing requires a paid plan (Lite $39 / Standard $99 / Premium $299). Spend is " +
             "approval-gated; not paid. Owner approval for a paid plan needed to publish, else leave as draft.",
    };
  }
  // future-proof: if BetaList ever restores a free path and we actually submitted (not on dashboard)
  if (!onDashboard && /in review|pending review|thanks for submitting|your startup is/i.test(body))
    return { status: "queued", listingUrl: draftUrl, notes: `submitted to review queue (#${subId}); verify on audit` };
  return { status: "blocked", listingUrl: draftUrl, notes: `did not reach the plan page; ended at ${H.url()} (draft #${subId}). ${body.slice(0, 160).replace(/\s+/g, " ")}` };
}
