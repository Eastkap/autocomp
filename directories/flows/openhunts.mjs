// openhunts.mjs — Weekly Brief flow. Login with Google: boseclaw is already signed into Google in
// the captured session, so clicking the "Login with Google" BUTTON does a full-page OAuth redirect
// that completes passwordless and lands on the dashboard — works headless (the One Tap card, by
// contrast, only completes headful, so we deliberately use the button, not the iframe). OAuth also
// skips the Cloudflare Turnstile on the email path. Then fill the submit form at /projects/submit.
import fs from "node:fs";
import path from "node:path";

export const meta = {
  directory: "openhunts",
  home: "https://openhunts.com",
  submitUrl: "https://openhunts.com/projects/submit",
};

// True once /dashboard actually renders the authed dashboard.
async function loggedIn(H) {
  await H.goto("https://openhunts.com/dashboard");
  await H.wait(4000);
  if (/sign-in|\/login/.test(H.url())) return false;
  const body = await H.text();
  return /My Projects|Welcome,|Growth Center/i.test(body);
}

async function ensureLoggedIn(H) {
  if (await loggedIn(H)) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    await H.goto("https://openhunts.com/sign-in");
    await H.wait(5000);
    // The button (role) does a full-page OAuth redirect — reliable headless. Avoid the One Tap iframe.
    try {
      await H.page.getByRole("button", { name: /Login with Google/i }).click({ timeout: 8000 });
    } catch { /* retry loop */ }
    await H.wait(9000);  // full-page redirect through accounts.google.com → back to app
    if (await loggedIn(H)) return true;
  }
  return false;
}

export default async function launch({ H, kit }) {
  await H.goto(meta.home); await H.wait(3000);

  if (!(await ensureLoggedIn(H))) {
    const p = await H.shot("login-failed");
    return { status: "blocked", listingUrl: null, notes: `Google OAuth login did not complete after retries; proof ${p}` };
  }

  // ---- dedup: already have a live listing? ----
  await H.goto("https://openhunts.com/dashboard"); await H.wait(4000);
  const dash = await H.text();
  if (new RegExp(kit.name, "i").test(dash) && !/No projects yet/i.test(dash)) {
    return { status: "already-live", listingUrl: `https://openhunts.com/projects/${kit.slug}`, notes: "listing already exists (on dashboard) — not duplicated" };
  }

  // ---- reach the submit form, switch to manual entry ----
  await H.goto(meta.submitUrl); await H.wait(6000);
  await H.clickIf("text=Or click here to fill manually", 6000); await H.wait(3000);

  // ---- step 1: Project Info ----
  // Website URL is a required field (the auto-fill box). Fill it but do NOT click Auto-fill —
  // we set copy manually so we control positioning (kit says RANKS, never "summarize").
  await H.fill("#url-analyzer-input", kit.url);
  await H.fill("#name", kit.name);
  await H.fill("#tagline", kit.tagline);
  // Description is a rich-text (ProseMirror) contenteditable — click in, type kit.description.
  const editor = H.page.locator('[contenteditable="true"]').first();
  await editor.click();
  await editor.fill(kit.description).catch(async () => { await H.page.keyboard.type(kit.description, { delay: 5 }); });
  await H.wait(800);

  // Categories are capitalized clickable chips (not <button>) — exact-text click works.
  const chip = async (label) => {
    try { await H.page.getByText(label, { exact: true }).first().click({ timeout: 3000 }); await H.wait(400); } catch { /* skip */ }
  };
  // Categories (max 3): kit has Productivity, AI, Email — "Email" has no chip, use Marketing Tools.
  for (const cat of ["Productivity", "Artificial Intelligence", "Marketing Tools"]) await chip(cat);
  // Platforms + Pricing option labels are lowercase in the DOM (CSS capitalizes them visually) and
  // rendered across spans, so getByText fails. Match on whitespace-stripped, lowercased exact text
  // and click the SMALLEST such box (the option itself, not an ancestor).
  const boxClick = async (label) => {
    return await H.page.evaluate((lbl) => {
      const norm = (s) => (s || "").replace(/\s+/g, "").toLowerCase();
      const want = norm(lbl);
      const els = Array.from(document.querySelectorAll("div,button,label,p,a,span"))
        .filter((e) => norm(e.textContent) === want && e.offsetParent !== null)
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter((x) => x.r.width > 10 && x.r.height > 8);
      els.sort((a, b) => (a.r.width * a.r.height) - (b.r.width * b.r.height));
      if (els[0]) { els[0].e.click(); return true; }
      return false;
    }, label);
  };
  await boxClick("Web");        // Platforms
  await H.wait(500);
  await boxClick("Freemium");   // Pricing — FREE tier only, never Paid
  await H.wait(500);

  // Logo (required, file input nth 0) + Product image (required). Download the product screenshot.
  let productFile = kit.logoFile;
  try {
    if (kit.screenshot) {
      const pf = path.join(path.dirname(kit.logoFile || "/tmp/x"), `${kit.slug}-screenshot.png`);
      if (!fs.existsSync(pf)) {
        const r = await fetch(kit.screenshot);
        fs.writeFileSync(pf, Buffer.from(await r.arrayBuffer()));
      }
      productFile = pf;
    }
  } catch { /* fall back to logo */ }
  const fileInputs = H.page.locator('input[type="file"]');
  if (kit.logoFile) await fileInputs.nth(0).setInputFiles(kit.logoFile).catch(() => {});
  await H.wait(1500);
  // Product image: trigger the "Upload Product Image" chooser and set the file on it.
  if (productFile) {
    try {
      const [fc] = await Promise.all([
        H.page.waitForEvent("filechooser", { timeout: 6000 }),
        H.page.getByText("Upload Product Image").first().click({ timeout: 5000 }),
      ]);
      await fc.setFiles(productFile);
    } catch {
      // fallback: set on the remaining file inputs
      for (const i of [1, 2, 3]) await fileInputs.nth(i).setInputFiles(productFile).catch(() => {});
    }
  }
  await H.wait(2500);

  await H.shot("step1-filled");
  // advance to step 2 "How do you want to launch?"
  await H.clickIf('button:has-text("Next")', 6000);
  await H.wait(5000);

  // ---- step 2: choose the FREE launch (Premium is pre-selected → must switch). Decline all
  // paid upsells (Premium $9.9, Highlight $20, SEO Scale Pack $199). ----
  // The "$0" price is unique to the Free option; clicking it selects that row's radio.
  const selectFree = async () => {
    try { await H.page.getByText("$0", { exact: true }).first().click({ timeout: 4000 }); return true; } catch {}
    try { await H.page.getByText(/^Free$/).first().click({ timeout: 4000 }); return true; } catch {}
    return false;
  };
  await selectFree();
  await H.wait(2000);
  // confirm the free plan took: the primary button should now read "Submit", not "Pay and Submit".
  let freeOK = !(await H.has('button:has-text("Pay and Submit")'));
  if (!freeOK) { await selectFree(); await H.wait(2000); freeOK = !(await H.has('button:has-text("Pay and Submit")')); }
  // Safety: never pay. If the free plan didn't take, bail out rather than click "Pay and Submit".
  if (!freeOK) {
    await H.shot("free-selected");
    return { status: "blocked", listingUrl: null, notes: "could not switch to the FREE launch plan (still 'Pay and Submit'); declined to pay — see free-selected shot" };
  }

  // Free plan requires picking a launch week WITH AVAILABLE SLOTS. The Radix listbox marks each
  // week "Full" or not; find the first NON-full week, then set its value on the hidden native
  // <select> (Radix syncs to it) and fire events so React registers it.
  await H.clickIf("text=Select week", 4000); await H.wait(1800);
  const weekSet = await H.page.evaluate(() => {
    const sel = document.querySelector("select");
    if (!sel) return { note: "no-select" };
    const opts = Array.from(document.querySelectorAll('[role="option"]'));
    const total = opts.length;
    // a week is available if its option text does NOT contain "Full"
    const availIdx = opts.findIndex((o) => !/full/i.test(o.textContent || ""));
    if (availIdx < 0) return { note: "all-full", total };
    // map to native select option (same order); prefer matching by value if available
    const wantVal = opts[availIdx].getAttribute("data-value") || null;
    let idx = availIdx;
    if (wantVal) { const j = Array.from(sel.options).findIndex((o) => o.value === wantVal); if (j >= 0) idx = j; }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    setter.call(sel, sel.options[idx].value);
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return { note: "set", total, availIdx, val: sel.options[idx].value, label: (opts[availIdx].textContent || "").trim().slice(0, 24) };
  });
  const weekNote = JSON.stringify(weekSet);
  await H.press("Escape").catch(() => {});   // close the listbox
  await H.wait(1200);
  await H.shot("week-selected");

  // If every listed week is full, the free queue has no open slot — genuine block (don't pay).
  if (weekSet.note === "all-full") {
    return { status: "blocked", listingUrl: null, notes: `FREE launch queue fully booked — all ${weekSet.total} listed weeks (~2yr out) marked "Full". Declined all paid plans (Premium $9.9 / Highlight $20). Other free path is "add our badge to skip the wait" (embed OpenHunts' badge on brief.limed.tech + verify) — a separate site change. Listing fully prepared; only the slot blocks.` };
  }

  // Submit — free path button reads "Confirm and Submit" / "Submit" (never "Pay and Submit").
  const submitClicked = await H.clickIf('button:has-text("Submit"):not(:has-text("Pay"))', 6000);
  await H.wait(7000);
  await H.shot("after-submit");

  const after = await H.text();
  const url = H.url();
  if (/pay|payment|checkout|stripe/i.test(url)) {
    return { status: "blocked", listingUrl: null, notes: `landed on a payment page (${url}) — declined to pay. See free-selected shot.` };
  }
  // Success = redirected to the live project page (/projects/<slug>, not /submit).
  const projectMatch = url.match(/\/projects\/(?!submit)([^/?#]+)/);
  const listingUrl = projectMatch ? url.split(/[?#]/)[0] : `https://openhunts.com/projects/${kit.slug}`;
  const confirmed = /scheduled for launch|successfully|has been submitted/i.test(after);
  if (projectMatch || confirmed) {
    return { status: "submitted", listingUrl, notes: `listing created & Scheduled on the FREE plan (earliest open slot ${weekSet.label}); paid upsells (Premium/Highlight/SEO) declined. week=${weekNote}` };
  }
  return { status: "blocked", listingUrl: null, notes: `submit clicked (${submitClicked}) but no confirmation/redirect; week=${weekNote}; still at ${url}. body=${after.slice(0, 200).replace(/\n+/g, " | ")}` };
}
