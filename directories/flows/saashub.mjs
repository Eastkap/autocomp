// saashub.mjs — Weekly Brief flow for SaaSHub (saashub.com). Proven 2026-07-07 (submitted).
//
// SaaSHub has NO OAuth — the only way in is an email register form (email / username / password)
// gated by hCaptcha. Camoufox's passive check does NOT pass here (clicking "I am human" pops a
// grid image challenge), so we solve the hCaptcha with 2Captcha via H.solveCaptcha() and submit.
//
// Flow: (1) dedup against the live site; (2) register + 2Captcha-solve the hCaptcha (retry once
// on a bad token); (3) submit the product at /services/submit → /services/new (SaaSHub auto-fetches
// name/tagline from the URL — we overwrite with kit copy to respect positioning), on the FREE plan
// (never the $75 Priority+ button); (4) finalize the optional competitor step → the product lands
// on its /manage/<slug> page as "Pending approval".
//
// IMPORTANT — email verification: SaaSHub refuses to advance past the URL step until the account's
// email is verified ("You need to verify your email to submit a new product."). The verification
// link is emailed to boseclaw@gmail.com; hitting it (once) verifies the account for good. This flow
// returns `blocked` with a clear note if it hits that wall; run `node verify-email.mjs` (opens
// boseclaw's Gmail, clicks the SaaSHub confirm link) once, then re-run — the saved session persists.
// Account: boseclaw@gmail.com / username "weekly-brief" (email-verified). Password in .secrets/accounts.env.
export const meta = {
  directory: "saashub",
  home: "https://www.saashub.com",
  submitUrl: "https://www.saashub.com/submit",
  registerUrl: "https://www.saashub.com/register",
};

const ACCOUNT = {
  // credentials by name from .secrets/accounts.env (loaded by engine.mjs) — never hardcode secrets
  email: process.env.SAASHUB_EMAIL || "boseclaw@gmail.com",
  username: process.env.SAASHUB_USERNAME || "weekly-brief",
  password: process.env.SAASHUB_PASSWORD,
};

export default async function launch({ H, kit }) {
  const page = H.page;

  // ---- 1. dedup: is Weekly Brief (brief.limed.tech) already listed? ----
  await H.goto(`https://www.saashub.com/search?q=${encodeURIComponent(kit.name)}`);
  await H.wait(4000);
  // SaaSHub search is semantic (returns many near-matches), so only treat an exact
  // name+our-domain hit as a real dup; a fuzzy title match is NOT our product.
  const results = await H.text().catch(() => "");
  if (/brief\.limed\.tech/i.test(results)) {
    // find the anchor whose href points at our product
    const href = await page.locator("a[href*='saashub.com']").evaluateAll(
      (as) => as.map((a) => a.href).find((h) => /saashub\.com\/[a-z0-9-]+$/i.test(h)) || null
    ).catch(() => null);
    return { status: "already-live", listingUrl: href || meta.home,
      notes: "Weekly Brief already listed on SaaSHub (matched brief.limed.tech) — not duplicated." };
  }

  // ---- 2. register (only email signup exists; hCaptcha-gated) ----
  await H.goto(meta.registerUrl);
  await H.wait(4000);

  // already logged in from a prior run? header would show a dashboard/username, not Register/Login
  if (!(await H.has("#user_email"))) {
    // not on the register form — likely already authenticated; jump to submit
    return submitProduct({ H, kit, page });
  }

  await H.fill("#user_email", ACCOUNT.email);
  await H.fill("#user_username", ACCOUNT.username);
  await H.fill("#user_password", ACCOUNT.password);
  await H.fill("#user_password_confirmation", ACCOUNT.password);
  await H.wait(1500);

  // hCaptcha wall: Camoufox's passive check does NOT pass here (clicking "I am human" pops a
  // grid image challenge). Solve it via 2Captcha — solveCaptcha() detects the sitekey, pays for
  // a token, and injects it into the hidden h-captcha-response field. Retry once on a bad token.
  let registered = false;
  for (let attempt = 1; attempt <= 2 && !registered; attempt++) {
    const solved = await H.solveCaptcha();
    if (!solved) { await H.wait(2000); continue; }
    await H.wait(1500);
    await clickAny(H, ["input[type='submit']", "button[type='submit']", "button:has-text('Register')", "text=Register"]);
    await H.wait(7000);
    const afterReg = (await H.text().catch(() => "")).toLowerCase();
    const stillOnRegister = /\/register/.test(H.url());
    const rejected = stillOnRegister && /captcha|verify you are|invalid|failed|try again/i.test(afterReg);
    if (!stillOnRegister || /log ?out|dashboard|welcome|profile|settings/i.test(afterReg)) {
      registered = true;
    } else if (rejected && attempt < 2) {
      // bad token — reload the form and try a fresh solve
      await H.shot(`register-retry${attempt}`);
      await H.goto(meta.registerUrl); await H.wait(3000);
      await H.fill("#user_email", ACCOUNT.email);
      await H.fill("#user_username", ACCOUNT.username);
      await H.fill("#user_password", ACCOUNT.password);
      await H.fill("#user_password_confirmation", ACCOUNT.password);
      await H.wait(1000);
    } else {
      break;
    }
  }

  await H.shot("after-register");
  if (!registered && /\/register/.test(H.url())) {
    // maybe the username/email is already taken from a prior run → try logging in instead
    const loggedIn = await tryLogin({ H });
    if (!loggedIn) {
      return { status: "blocked", listingUrl: null,
        notes: `register did not complete at ${H.url()} (captcha token rejected or validation error); nothing submitted.` };
    }
  }

  // ---- 3. account created / logged in → submit the product ----
  return submitProduct({ H, kit, page });
}

// Submit Product flow — reached once authenticated. Two steps: a URL-entry page, then the
// /services/new detail form (auto-fetched from the URL). Selectors verified against the live
// form. Returns an honest status based on what the page actually shows.
async function submitProduct({ H, kit }) {
  // Step 1: URL-entry page → enter product URL → Continue. (Email must be verified first, else
  // SaaSHub shows "You need to verify your email to submit a new product." and refuses to advance.)
  await H.goto("https://www.saashub.com/services/submit");
  await H.wait(3500);
  if (!(await H.has("input[name='url']"))) {
    return { status: "blocked", listingUrl: null,
      notes: `submit URL field not found at ${H.url()} (not logged in / CF interstitial); nothing submitted.` };
  }
  await H.fill("input[name='url']", kit.url);
  await H.wait(600);
  await H.click("input[name='commit']");   // "Continue"
  await H.wait(6000);

  if (/verify your email/i.test(await H.text().catch(() => ""))) {
    await H.shot("needs-email-verify");
    return { status: "blocked", listingUrl: null,
      notes: "account created but SaaSHub requires email verification before submitting; verify boseclaw@gmail.com then re-run." };
  }
  if (!(await H.has("#service_name"))) {
    await H.shot("no-detail-form");
    return { status: "blocked", listingUrl: null,
      notes: `did not reach the product detail form; ended at ${H.url()}.` };
  }

  // Step 2: detail form (/services/new) — SaaSHub auto-fetches name/tagline from the URL.
  // Overwrite with our copy (positioning: RANKS, never "summarizes"), add categories, keep FREE.
  await H.fill("#service_name", kit.name);
  await H.fill("#service_tagline", kit.tagline);
  await H.wait(500);
  // categories: a react-select tag input — type each, wait for the option, Enter to add.
  for (const c of kit.categories) {
    await H.clickIf("#react-select-2-input", 4000);
    await H.type("#react-select-2-input", c);
    await H.wait(1600);
    await H.press("Enter");
    await H.wait(700);
  }
  await H.shot("detail-filled");

  // Submit on the FREE plan. NEVER the "$75 / One Off" priority button (name=priority_approval).
  const freeClicked = await clickAny(H, [
    "button:has-text('Free'):not([name='priority_approval'])",
    "form button:has-text('Free')",
    "button:has-text('Free')",
  ]);
  if (!freeClicked) {
    await H.shot("no-free-button");
    return { status: "blocked", listingUrl: null, notes: `filled the form but could not find the Free submit button at ${H.url()}.` };
  }
  await H.wait(7000);
  await H.shot("after-submit");

  const url = H.url();
  const body = (await H.text().catch(() => "")).toLowerCase();
  const onPaywall = /priority_approval|\$75|payment|checkout|stripe/i.test(body) && /pay|card number/i.test(body);
  if (onPaywall) {
    return { status: "blocked", listingUrl: null, notes: "submit routed to a paid checkout; did not pay (free tier only)." };
  }
  const ok = /submitted|thank you|pending|approval|added|success|your product|in the queue|waiting/i.test(body)
    || /\/services\//.test(url) || new RegExp(kit.slug, "i").test(url);
  const listingUrl = /\/(services\/)?[a-z0-9-]+$/i.test(url) && !/\/services\/(new|submit)$/i.test(url) ? url : null;
  return ok
    ? { status: "submitted", listingUrl: listingUrl || url,
        notes: "submitted on the FREE plan (paid $75 priority declined) — pending SaaSHub approval; verify on audit." }
    : { status: "failed", listingUrl: null, notes: `no submit confirmation at ${url}.` };
}

// fallback: if the account already exists (re-run), log in instead of registering.
async function tryLogin({ H }) {
  await H.goto("https://www.saashub.com/login");
  await H.wait(4000);
  if (!(await H.has("input[type='password']"))) return false;   // CF interstitial or unexpected page
  await tryFill(H, ["#user_email", "#user_login", "input[name='user[email]']", "input[name='user[login]']", "input[type='email']"], ACCOUNT.email);
  await H.fill("input[type='password']", ACCOUNT.password).catch(() => {});
  await H.wait(1000);
  await H.solveCaptcha().catch(() => false);   // login is also hCaptcha-gated
  await H.wait(1500);
  await clickAny(H, ["input[type='submit']", "button[type='submit']", "button:has-text('Login')", "text=Login"]);
  await H.wait(6000);
  return !/\/login/.test(H.url());
}

// click the first selector that exists (avoids Playwright's illegal css+text= mixing).
async function clickAny(H, selectors) {
  for (const s of selectors) { if (await H.clickIf(s, 4000)) return true; }
  return false;
}

async function tryFill(H, selectors, value) {
  for (const s of selectors) {
    if (await H.has(s)) { await H.fill(s, value).catch(() => {}); return true; }
  }
  return false;
}
