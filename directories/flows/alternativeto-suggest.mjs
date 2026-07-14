// alternativeto-suggest.mjs — follow-up to the 2026-07-14 Weekly Brief submission.
// The app was added (id f069f821-6ca4-4398-a5db-6cbab4642ca6) but has NO alternatives yet;
// AlternativeTo's own banner: "Apps without alternatives are almost invisible on AlternativeTo".
// This flow suggests existing apps (Mailbrew, Meco) as alternatives via the afterAdd page.
// Exploratory UI — every step screenshots; honest notes on whatever it reaches.
export const meta = {
  directory: "alternativeto-suggest",
  home: "https://alternativeto.net",
  submitUrl: "https://alternativeto.net/manage-add-alternatives/?id=f069f821-6ca4-4398-a5db-6cbab4642ca6&mode=afterAdd",
};

const CANDIDATES = ["Mailbrew", "Meco"];

export default async function launch({ H }) {
  const page = H.page;
  const notes = [];
  let added = 0;

  // ensure logged in (same GitHub-OAuth step as the main alternativeto flow)
  await H.goto("https://alternativeto.net/api/auth/login");
  await H.wait(6000);
  if (await H.has("text=Continue with GitHub")) {
    await H.click("text=Continue with GitHub"); await H.wait(9000);
    await H.clickIf("button:has-text('Authorize AlternativeTo')", 7000); await H.wait(8000);
  }
  await H.wait(2000);
  await H.shot("post-login");
  if (/auth0|\/login|\/user\/create/.test(H.url())) {
    return { status: "blocked", listingUrl: null, notes: `login did not complete — landed on ${H.url()}` };
  }

  for (const name of CANDIDATES) {
    try {
      await H.goto(meta.submitUrl);
      await H.wait(4000);
      await H.clickIf("text=Consent", 3000);

      // the "Search for an existing alternative" input (placeholder "Type...")
      // ONLY the in-panel "Search for an existing alternative" input (placeholder "Type...");
      // a broader OR-locator matched the site-wide header search, which navigates away on select.
      const input = page.locator('input[placeholder^="Type"]').first();
      await input.waitFor({ state: "visible", timeout: 15000 });
      await input.click();
      await input.type(name, { delay: 60 });
      await H.wait(4500);
      await H.shot(`search-${name.toLowerCase()}`);

      // dump what the dropdown actually rendered (for honest debugging)
      const dom = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[role="listbox"], [role="option"], [class*="autocomplete"], [class*="suggest"], [class*="dropdown"]')];
        return els.slice(0, 6).map((e) => e.outerHTML.slice(0, 300)).join("\n---\n");
      }).catch(() => "");
      if (dom) notes.push(`${name} dropdown DOM: ${dom.replace(/\s+/g, " ").slice(0, 220)}`);

      // select via keyboard — avoids clicking a link that navigates away
      await H.press("ArrowDown");
      await H.wait(800);
      await H.press("Enter");
      await H.wait(4000);
      await H.shot(`picked-${name.toLowerCase()}`);
      if (!/manage-add-alternatives/.test(H.url())) {
        notes.push(`${name}: keyboard select navigated away to ${H.url()} — not registered`);
        continue;
      }

      // page now stages "<name> will be added as an alternative" + checkbox rows of that app's
      // own alternatives. Tick the genuinely-comparable newsletter-digest apps, then finalize
      // with the green "Suggest N alternatives" button (nothing registers without it).
      const rows = page.locator('button:has-text("Suggest as alternative")');
      const nRows = await rows.count();
      for (let i = 0; i < nRows; i++) {
        const row = rows.nth(i);
        const ctx = await row.evaluate((el) => (el.closest("div[class*='border'], li, article") || el.parentElement.parentElement)?.innerText || "").catch(() => "");
        if (/mailbrew|meco|readless|letterboxx|bilig|stoop/i.test(ctx)) {
          await row.click().catch(() => {});
          await H.wait(600);
          notes.push(`${name}: also ticked ${ (ctx.split("\n")[0] || "?").slice(0, 40) }`);
        }
      }
      const finalize = page.locator("button", { hasText: /Suggest \d+ alternative/ }).first();
      if (!(await finalize.count())) { notes.push(`${name}: staged but NO finalize button found — not registered`); continue; }
      await finalize.click();
      await H.wait(5000);
      await H.shot(`after-${name.toLowerCase()}`);
      const body = (await H.text()).slice(0, 500).replace(/\s+/g, " ");
      notes.push(`${name}: finalized; page now: ${body.slice(0, 160)}`);
      added++;
    } catch (e) {
      notes.push(`${name}: ${(e.message || String(e)).slice(0, 140)}`);
    }
  }

  return {
    status: added > 0 ? "submitted" : "blocked",
    listingUrl: "https://alternativeto.net/software/weekly-brief/",
    notes: notes.join(" | ").slice(0, 900),
  };
}
