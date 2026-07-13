// awesomeindie.mjs — Weekly Brief flow, proven 2026-07-07. Google OAuth login, fill form,
// add categories (rc_select), submit. No logo required. "Product created successfully!".
export const meta = {
  directory: "awesomeindie",
  home: "https://awesomeindie.com",
  submitUrl: "https://awesomeindie.com/submit",
};

export default async function launch({ H, kit }) {
  await H.goto(meta.submitUrl);
  await H.wait(3500);

  // ---- login via Google if bounced to /login ----
  if (/\/login/.test(H.url()) || await H.has("text=Continue with Google")) {
    await H.click("text=Continue with Google");
    await H.wait(6000);
    // account chooser / consent, if shown
    await H.clickIf("text=Bose Claw", 6000); await H.wait(4000);
    await H.clickIf("text=Continue", 6000); await H.wait(4000);
    await H.goto(meta.submitUrl); await H.wait(3500);
  }

  // ---- fill the form ----
  await H.fill("#title", kit.name);
  await H.fill("#website", kit.url);
  await H.fill("#tagline", kit.tagline);
  await H.fill("#description", kit.description);
  // categories: rc_select tag input — type + Enter per valid category
  await H.click("#rc_select_0");
  for (const c of kit.categories) {
    await H.type("#rc_select_0", c); await H.wait(1200); await H.press("Enter"); await H.wait(600);
  }
  await H.wait(600);

  await H.click("button:has-text('Submit product')");
  await H.wait(5000);

  const body = await H.text();
  const ok = /success|created successfully|submitted|isCompleted=true/i.test(body) || /isCompleted=true/.test(H.url());
  return ok
    ? { status: "submitted", listingUrl: meta.home, notes: "Product created successfully — pending moderation queue" }
    : { status: "failed", listingUrl: null, notes: `no success confirmation; at ${H.url()}` };
}
