// peerpush.mjs — Weekly Brief flow, proven 2026-07-07. Google OAuth (passes the Turnstile),
// AI-autofill from URL, override copy to respect positioning, upload logo, join the FREE queue,
// decline the paid upsell. Returns a proof record with the live listing URL.
export const meta = {
  directory: "peerpush",
  home: "https://peerpush.com",
  submitUrl: "https://peerpush.com/submit",
};

export default async function launch({ H, kit }) {
  await H.goto(meta.submitUrl);
  await H.wait(5000);

  // ---- login via Google if not already signed in (boseclaw) ----
  if (await H.has("text=Continue with Google")) {
    await H.click("text=Continue with Google"); await H.wait(7000);
    await H.clickIf("text=Bose Claw", 8000); await H.wait(8000);
    await H.clickIf("text=Continue", 8000); await H.wait(8000);   // OAuth consent, if shown
    await H.goto(meta.submitUrl); await H.wait(5000);
  }

  // ---- AI autofill from the product URL, then correct the generated copy ----
  await H.fill('input[placeholder="https://yourproduct.com"]', kit.url);
  await H.click("text=Autofill with AI");
  await H.wait(22000);
  await H.fill('input[name="tagline"]', kit.tagline);        // generated tagline said "summaries"
  await H.fill('textarea[name="description"]', kit.description);
  if (kit.logoFile) await H.upload("#logo-upload", kit.logoFile);  // logo is required
  await H.wait(2500);

  // ---- submit → lands on plan chooser ----
  await H.click("text=Submit");
  await H.wait(7000);
  let url = H.url();
  if (!/\/plans/.test(url) && !/\/p\//.test(url)) {
    return { status: "failed", notes: `submit did not advance; at ${url}`, listingUrl: null };
  }

  // ---- choose the FREE launch queue, decline the paid upsell modal ----
  await H.goto(`https://peerpush.com/p/${kit.slug}/plans`); await H.wait(4000);
  await H.clickIf("text=Join free launch queue", 6000); await H.wait(3500);
  await H.clickIf("text=Wait in free queue", 6000); await H.wait(6000);   // "save $263" upsell → decline

  const body = await H.text();
  const listingUrl = `https://peerpush.com/p/${kit.slug}`;
  if (/in queue|queue position|not yet visible/i.test(body)) {
    const pos = (body.match(/#\s?(\d{2,6})/) || [])[0] || "";
    return { status: "queued", listingUrl, notes: `free launch queue ${pos}; ~23d wait; paid upsells declined` };
  }
  return { status: "submitted", listingUrl, notes: "submitted; verify queue/live state on next audit" };
}
