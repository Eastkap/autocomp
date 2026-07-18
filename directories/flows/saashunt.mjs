// saashunt.mjs — Weekly Brief flow, 2026-07-18. Next.js SPA (DirEasy platform).
// Login: navbar "Sign in" → GitHub OAuth (bot Google session dead, card 88a4ad07).
// Submit: nav "Submit Project" → 4-step wizard (Project Info → Details → Launch Date → Review).
// Project Info: name + url inputs, Short Description = rich-text contenteditable, Logo +
// Product Image uploads via hidden input[type=file]. Screenshot pre-fetched to /tmp/wb-shot.png
// (engine only pre-downloads kit.logo). "AI Autofill" button deliberately NOT used —
// positioning rule bans generated "summarizes" copy.
import fs from "node:fs";

export const meta = {
  directory: "saashunt",
  home: "https://saashunt.best",
  submitUrl: "https://saashunt.best/projects/submit",
};

async function dumpFields(H) {
  return H.page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select, button, [contenteditable]")].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      name: el.name || null,
      id: el.id || null,
      placeholder: el.placeholder || null,
      editable: el.getAttribute("contenteditable"),
      text: el.tagName === "BUTTON" ? (el.innerText || "").trim().slice(0, 50) : null,
    }))
  );
}

export default async function launch({ H, kit }) {
  // product image the wizard requires (16:9)
  const shotFile = "/tmp/wb-shot.png";
  if (!fs.existsSync(shotFile) && kit.screenshot) {
    const r = await fetch(kit.screenshot);
    fs.writeFileSync(shotFile, Buffer.from(await r.arrayBuffer()));
  }

  await H.goto(meta.home);
  await H.wait(5000);

  // ---- login only if a Sign in affordance is visible (session usually hot) ----
  if (await H.has("button:has-text('Sign in'), a:has-text('Sign in')")) {
    await H.clickIf("button:has-text('Sign in')", 5000) || await H.clickIf("a:has-text('Sign in')", 3000);
    await H.wait(2500);
    await H.shot("signin-surface");
    const gh =
      (await H.clickIf("button:has-text('GitHub')", 6000)) ||
      (await H.clickIf("a:has-text('GitHub')", 4000));
    if (!gh) return { status: "blocked", listingUrl: null, notes: `no GitHub sign-in found; at ${H.url()}` };
    await H.wait(6000);
    if (/github\.com/.test(H.url())) {
      await H.clickIf("button:has-text('Authorize')", 8000);
      await H.wait(7000);
    }
    await H.goto(meta.home);
    await H.wait(4000);
  }

  // ---- step 1: Project Info ----
  await H.goto(meta.submitUrl);
  await H.wait(5000);
  const inputs = (await dumpFields(H)).filter((f) => f.tag === "input");
  const pick = (re) => inputs.find((f) => re.test(`${f.name} ${f.id} ${f.placeholder}`));
  const sel = (f) => (f?.id ? `[id="${f.id}"]` : f?.name ? `[name="${f.name}"]` : null);
  const nameF = sel(pick(/name|title/i));
  const urlF = sel(pick(/url|website|link/i));
  if (!nameF || !urlF)
    return { status: "blocked", listingUrl: null, notes: `step1 fields not found; at ${H.url()}; ${JSON.stringify(inputs.slice(0, 10))}` };
  await H.fill(nameF, kit.name);
  await H.fill(urlF, kit.url);

  // short description — rich-text contenteditable
  const rte = H.page.locator('[contenteditable="true"]').first();
  await rte.click({ timeout: 10000 });
  await rte.fill(kit.summary + " " + kit.description).catch(async () => {
    await H.page.keyboard.type(kit.summary + " " + kit.description, { delay: 5 });
  });

  // uploads: hidden file inputs (1st = logo, 2nd = product image)
  const files = H.page.locator('input[type="file"]');
  const nFiles = await files.count();
  if (nFiles >= 1 && kit.logoFile) await files.nth(0).setInputFiles(kit.logoFile);
  if (nFiles >= 2) await files.nth(1).setInputFiles(shotFile);
  await H.wait(3000);
  await H.shot("step1-filled");

  await H.click("button:has-text('Next')");
  await H.wait(4000);
  await H.shot("step2-details");

  // ---- step 2: Details ----
  // Categories: searchable checkbox list, max 3. Search then click the exact label text
  // (clicking the text toggles the checkbox). Site's list may not have our exact names —
  // clickIf-and-skip. Also toggles OFF any stray pre-selection from an earlier run.
  // NB: the wizard persists a draft across sessions — chips from earlier runs survive.
  // Search narrows the checkbox list; click the LIST label (.last() — .first() hits the
  // selected-chip text, which does nothing), never the chip.
  const searchBox = H.page.locator('input[placeholder*="Search categories"]');
  const checkedOf = async (box) => {
    const s = (await box.getAttribute("data-state").catch(() => "")) ||
      (await box.getAttribute("aria-checked").catch(() => "")) || "";
    return /checked|true/.test(s) && !/unchecked/.test(s);
  };
  // search narrows the list to one row; its checkbox is the topmost one below the search box
  const setCat = async (name, want) => {
    try {
      await searchBox.fill(name);
      await H.wait(900);
      const target = H.page
        .locator(
          '[role="checkbox"]:below(input[placeholder*="Search categories"]), input[type="checkbox"]:below(input[placeholder*="Search categories"])'
        )
        .first();
      if ((await checkedOf(target)) !== want) { await target.click({ timeout: 3000 }); await H.wait(500); }
      return true;
    } catch { return false; }
  };
  await setCat("Price Monitoring", false); // stray from run 2's type-ahead
  for (const c of ["Productivity", "Email", "AI & Machine Learning"]) await setCat(c, true);
  await searchBox.fill("").catch(() => {});

  // Tech Stack: freeform tags, type + Enter (honest stack: Cloudflare Pages + Supabase + AI)
  const tech = H.page.locator('input[placeholder*="technology"]');
  for (const t of ["Cloudflare", "Supabase", "AI"]) {
    await tech.fill(t).catch(() => {});
    await H.press("Enter");
    await H.wait(400);
  }

  // Platforms: Web — locator clicks kept missing these custom checkboxes (runs 2-4), so
  // click the row programmatically inside the page (React handlers fire on JS click)
  const platClick = await H.page.evaluate(() => {
    // "Web" is a bare text node NEXT TO the checkbox inside the same row element — match
    // direct text nodes, not childless elements
    const rows = [...document.querySelectorAll("label, div, span")].filter((e) =>
      [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() === "Web")
    );
    for (const row of rows) {
      const box = row.querySelector('[role="checkbox"], input[type="checkbox"], button') || row;
      box.click();
      return "byText: " + (row.outerHTML || "").slice(0, 300);
    }
    // fallback: first checkbox inside the Platforms container (rows render Web first)
    const hint = [...document.querySelectorAll("*")].find(
      (e) => e.childElementCount === 0 && /Select all platforms/i.test(e.textContent)
    );
    const container = hint?.previousElementSibling || hint?.parentElement;
    const first = container?.querySelector('[role="checkbox"], input[type="checkbox"], button');
    if (first) { first.click(); return "byPosition: " + first.outerHTML.slice(0, 300); }
    return null;
  });
  console.error("PLATFORM-ROW>>> " + platClick);
  await H.wait(800);

  // Pricing Model: Freemium radio
  await H.clickIf(`text=${kit.pricing}`, 4000);
  await H.shot("step2-filled");
  await H.clickIf("button:has-text('Next')", 6000);
  await H.wait(4000);
  await H.shot("step3-launchdate");

  // ---- step 3: Launch Date — Free Launch ($0) + earliest date with free slots ----
  await H.clickIf("text=Free Launch", 3000); // usually pre-selected; never the paid cards
  await H.clickIf("text=Select a launch date", 4000); // open the dropdown
  await H.wait(1500);
  const pickedDate = await H.page.evaluate(() => {
    // slot-count spans are childless: "N free slot(s)"; DOM order = date order
    const spans = [...document.querySelectorAll("*")].filter(
      (e) => e.childElementCount === 0 && /^[1-9]\d* free slot/.test(e.textContent.trim())
    );
    if (!spans.length) return null;
    const row = spans[0].closest('[role="option"]') || spans[0].parentElement;
    row.click();
    return row.textContent.trim();
  });
  console.error("LAUNCH-DATE>>> " + pickedDate);
  await H.wait(1500);
  await H.shot("step3-date-picked");
  await H.clickIf("button:has-text('Next')", 6000);
  await H.wait(4000);
  await H.shot("step4-review");

  // ---- step 4: Review → Submit (free only) ----
  await H.clickIf("button:has-text('Submit')", 8000) || await H.clickIf("button:has-text('Launch')", 6000) ||
    await H.clickIf("button:has-text('Finish')", 5000) || await H.clickIf("button:has-text('Confirm')", 5000);
  await H.wait(6000);
  await H.shot("after-submit");

  const body = await H.text();
  const errBanner = /please complete|please select|is required|something went wrong/i.test(body);
  // real success = we LEFT the wizard (url changed) or explicit confirmation wording, with no error banner
  const ok = !errBanner &&
    (!/projects\/submit/.test(H.url()) || /submitted successfully|thank you|congratulat|under review/i.test(body));
  return ok
    ? { status: "submitted", listingUrl: H.url(), notes: "wizard completed; left submit page / confirmation shown" }
    : { status: "failed", listingUrl: null, notes: `wizard incomplete; at ${H.url()}; errBanner=${errBanner}` };
}
