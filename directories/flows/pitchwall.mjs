// pitchwall.mjs — Weekly Brief flow, proven 2026-07-07. Free plan → Google OAuth → AI-generate
// from URL → correct copy + unique slug → Next. NOTE: Weekly Brief was already live here, so this
// flow also detects the "page url has already been taken" case and reports already-live.
export const meta = {
  directory: "pitchwall",
  home: "https://pitchwall.co",
  submitUrl: "https://pitchwall.co/submit",
};

export default async function launch({ H, kit }) {
  const listingUrl = `https://pitchwall.co/product/${kit.slug}`;

  // fast path: is it already live? (dedup — don't duplicate)
  await H.goto(listingUrl); await H.wait(3000);
  const existing = await H.text();
  if (new RegExp(kit.name, "i").test(existing) && !/404|not found/i.test(existing)) {
    return { status: "already-live", listingUrl, notes: "listing already live — verified, not duplicated" };
  }

  // ---- free plan → login ----
  await H.goto(meta.submitUrl); await H.wait(3500);
  await H.clickIf("text=Select Plan >> nth=0", 6000); await H.wait(4000);   // Free Launch
  if (await H.has("text=Continue with Google")) {
    await H.click("text=Continue with Google"); await H.wait(4500);
    await H.clickIf("text=Bose Claw", 6000); await H.wait(4000);
    await H.clickIf("text=Continue", 6000); await H.wait(5000);
  }

  // ---- AI-generate from URL, correct copy + slug ----
  await H.goto("https://pitchwall.co/product/submit?plan=free"); await H.wait(4000);
  await H.fill("#v-0-1-1", kit.url);
  await H.clickIf("text=Add >> nth=0", 6000); await H.wait(20000);   // "Generating product details"
  await H.fill("#slug", kit.slug);
  await H.fill("#summary", kit.summary);
  await H.fill("#description", kit.description);
  await H.wait(600);
  await H.click("text=Next");
  await H.wait(5000);

  const body = await H.text();
  if (/already been taken/i.test(body)) {
    // slug taken usually means our own prior listing exists
    return { status: "already-live", listingUrl, notes: "slug taken — existing listing (verify on audit)" };
  }
  return { status: "submitted", listingUrl, notes: "advanced past step 1 — finish any remaining step then audit" };
}
