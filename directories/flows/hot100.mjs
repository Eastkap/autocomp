// hot100.mjs — Weekly Brief on hot100.ai. Google OAuth (OAuth-only). Weekly Brief was already
// submitted here (2026-07-04), so this flow verifies the live listing rather than duplicating.
// If no existing listing is found, it opens the submit page for a human/next iteration to extend.
export const meta = {
  directory: "hot100",
  home: "https://www.hot100.ai",
  submitUrl: "https://www.hot100.ai/new",
};

export default async function launch({ H, kit }) {
  // sign in with Google if needed
  await H.goto(meta.home); await H.wait(3000);
  if (await H.has("text=SIGN IN")) {
    await H.click("text=SIGN IN"); await H.wait(4000);
    await H.clickIf("text=boseclaw@gmail.com", 5000); await H.wait(4000);
    await H.clickIf("text=Bose Claw", 5000); await H.wait(4000);
    await H.clickIf("text=Continue", 6000); await H.wait(5000);
    await H.goto(meta.home); await H.wait(3000);
  }
  // is Weekly Brief already in the Launchpad feed?
  const body = await H.text();
  if (new RegExp(kit.name, "i").test(body)) {
    return { status: "already-live", listingUrl: meta.home, notes: "listing present in Launchpad feed — verified, not duplicated" };
  }
  return { status: "blocked", listingUrl: meta.submitUrl, notes: "no existing listing found; open /new to submit (form flow TBD)" };
}
