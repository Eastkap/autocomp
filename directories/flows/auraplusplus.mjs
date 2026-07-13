// auraplusplus.mjs — Weekly Brief flow for Aura++ (auraplusplus.com), proven 2026-07-07.
// Google OAuth login (skips the Cloudflare Turnstile on email signup), AI-autofill from the
// product URL (which also pulls the logo + product image straight off the site), then a 5-step
// wizard: Project Info → Details → Launch Date → Review → Backlink.
//
// Positioning: AI Autofill mis-titles the product "Weekly Newsletter Prioritizer" and writes copy
// that says it "summarizes" newsletters — a direct violation of kit.positioningRule. So this flow
// forces the name back to "Weekly Brief" and OVERWRITES the ProseMirror description with vetted,
// ranks-not-summarizes copy (>200 words, which Aura++ requires).
//
// FREE tier only: picks the "Free Launch" ($0) plan (pre-selected), uses the "random date
// (200+ days out)" option so we never need to hunt an open slot, and declines the "$17 Premium"
// upsell modal via "Continue with free launch".
//
// End state: clicking Next on the Review step SUBMITS the project (toast: "Project submitted!").
// The final Backlink step only gates *scheduling the launch live* — it needs a link back to
// auraplusplus.com added on brief.limed.tech, which is out of scope for this flow. So the honest
// result is `submitted` (in the boseclaw dashboard, pending backlink verification to go live).
export const meta = {
  directory: "auraplusplus",
  home: "https://auraplusplus.com",
  submitUrl: "https://auraplusplus.com/projects/submit",
};

// Positioning-correct description paragraphs (>200 words total, never uses the word "summar*").
const DESCRIPTION = [
  "Newsletter subscriptions all fail in the same way. Thirty issues land in your inbox every week, maybe three of them deserve your attention, and the ones actually worth reading drown under the ones that are not. Weekly Brief fixes that signal to noise problem without asking you to unsubscribe from anything you value.",
  "Connect your newsletter firehose and Weekly Brief quietly watches everything that arrives. Once a week it ranks every issue against the topics and writers you genuinely care about, then delivers a single prioritized brief with the must reads pulled to the top and everything else triaged below. Instead of scrolling a cluttered inbox, you get one clean reading list sent straight to Readwise Reader, Matter, or Kindle.",
  "The important distinction is simple. Weekly Brief only ranks your newsletters, it never rewrites or shortens them. You still open and read the original issues in full. It just decides the reading order, so you spend your limited time on the three that matter and skip the rest, confident that nothing important was buried at the bottom of the pile.",
  "It is built for people who follow more newsletters than they can realistically keep up with, from busy professionals and researchers to endlessly curious readers who want the value of a wide subscription list without the guilt of an overflowing inbox. Weekly Brief is free for up to ten newsletters, so you can point it at your busiest subscriptions today and watch your weekly reading load shrink down to what is truly worth your time.",
];

export default async function launch({ H, kit }) {
  const listingUrl = "https://auraplusplus.com/projects/weekly-brief";

  // ---- ensure logged in (Google OAuth — passes Turnstile passively) ----
  await H.goto(meta.submitUrl);
  await H.wait(4000);
  if (/\/sign-in/.test(H.url()) || await H.has("text=Login with Google")) {
    await H.click("text=Login with Google");
    await H.wait(7000);
    await H.clickIf("text=Bose Claw", 8000); await H.wait(7000);
    await H.clickIf("text=Continue", 8000);  await H.wait(8000);   // OAuth consent, if shown
    await H.goto(meta.submitUrl); await H.wait(4000);
  }

  // ---- dedup: is Weekly Brief already public, or already in our dashboard? ----
  const pub = await (await H.page.goto(listingUrl, { waitUntil: "domcontentloaded" }).then(() => H.text()).catch(() => ""));
  if (new RegExp(kit.name, "i").test(pub) && !/not found/i.test(pub)) {
    return { status: "already-live", listingUrl, notes: "listing already public — verified, not duplicated" };
  }
  await H.goto("https://auraplusplus.com/dashboard"); await H.wait(4000);
  const dash = await H.text();
  if (/Weekly Brief/i.test(dash)) {
    return { status: "submitted", listingUrl, notes: "already in boseclaw dashboard (pending backlink verification to schedule launch) — not duplicated" };
  }

  // ---- STEP 1 · Project Info: name + url, AI autofill (pulls logo + product image), then fix copy ----
  await H.goto(meta.submitUrl); await H.wait(4000);
  await H.fill("#name", kit.name);
  await H.fill("#websiteUrl", kit.url);
  await H.click("text=AI Autofill");
  await H.wait(35000);                         // autofill fetches the site + writes name/desc/logo/image
  await H.fill("#name", kit.name);             // autofill renamed it "Weekly Newsletter Prioritizer" — undo

  // overwrite the ProseMirror description (autofill copy says "summarizes" → positioning violation).
  // Use keyboard.insertText (instant) — page.type()'s 15s action timeout can't finish 1400 chars.
  await H.click(".ProseMirror");
  await H.press("Meta+A"); await H.wait(300);
  await H.press("Backspace"); await H.wait(500);
  for (let i = 0; i < DESCRIPTION.length; i++) {
    await H.page.keyboard.insertText(DESCRIPTION[i]);
    if (i < DESCRIPTION.length - 1) { await H.press("Enter"); await H.press("Enter"); }
    await H.wait(300);
  }
  await H.wait(1500);

  await H.click("button:has-text('Next')");
  await H.wait(3500);

  // ---- STEP 2 · Details: autofill already picked categories/tech/platform + Free pricing → just continue ----
  await H.click("button:has-text('Next')");
  await H.wait(3500);

  // ---- STEP 3 · Launch Date: FREE plan is pre-selected. Use a random date (200+ days out) ----
  await H.waitFor("text=Use random date", 25000);   // "Loading available dates…" can take ~15s
  await H.click("text=Use random date");
  await H.wait(1500);
  await H.click("button:has-text('Next')");
  await H.wait(4000);
  await H.clickIf("button:has-text('Continue with free launch')", 8000);  // decline the $17 Premium upsell
  await H.wait(4000);

  // ---- STEP 4 · Review → Next SUBMITS the project ----
  await H.click("button:has-text('Next')");
  await H.wait(6000);

  // ---- STEP 5 · Backlink: reaching it means the project was submitted ----
  const body = await H.text();
  const onBacklink = /Backlink Verification/i.test(body) || await H.has("button:has-text('Verify Backlink')");
  if (onBacklink) {
    return {
      status: "submitted",
      listingUrl,
      notes: "Submitted to Aura++ (Free Launch, random 200+ day slot; declined $17 upsell). In boseclaw dashboard as Pending. Goes live only after a backlink to auraplusplus.com is added on brief.limed.tech and 'Verify Backlink' is clicked — out of scope for this flow.",
    };
  }
  return { status: "failed", listingUrl, notes: `did not reach Backlink/submit confirmation; at ${H.url()}` };
}
