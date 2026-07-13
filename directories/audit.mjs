#!/usr/bin/env node
// audit.mjs — re-check every recorded submission's LIVE status + capture a fresh screenshot.
// Run daily (or point a sub-agent at it). Reads directories/proof/submissions.json, visits each
// listingUrl in the logged-in boseclaw session, decides live / pending / missing, screenshots to
// proof/audit-<slug>-<directory>.png, and rewrites the ledger with the audit result + timestamp.
//
//   node directories/audit.mjs [--slug weekly-brief]
//
// "live"    — listingUrl loads and the product name appears (publicly visible)
// "pending" — loads but shows queue/review/moderation wording (submitted, not yet public)
// "missing" — 404 / name absent (needs a resubmit — surfaced loudly)
import { Camoufox } from "camoufox-js";
import { LEDGER, PROOF_DIR, DEFAULT_STATE } from "./engine.mjs";
import fs from "node:fs";
import path from "node:path";

process.on("uncaughtException", () => {});
const argv = process.argv.slice(2);
const slugFilter = (() => { const i = argv.indexOf("--slug"); return i >= 0 ? argv[i + 1] : null; })();

if (!fs.existsSync(LEDGER)) { console.error("no ledger yet at " + LEDGER); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
const state = fs.existsSync(DEFAULT_STATE) ? DEFAULT_STATE : null;

const browser = await Camoufox({ headless: true, humanize: true });
const ctx = await browser.newContext(state ? { storageState: state, viewport: null } : { viewport: null });
const page = await ctx.newPage();
page.on("pageerror", () => {});

const now = new Date().toISOString();
let live = 0, pending = 0, missing = 0, skipped = 0;
for (const r of rows) {
  if (slugFilter && r.slug !== slugFilter) continue;
  if (!r.listingUrl) { r.audit = { status: "no-url", at: now }; skipped++; continue; }
  let verdict = "missing", body = "";
  try {
    const resp = await page.goto(r.listingUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    body = await page.evaluate(() => document.body?.innerText || "");
    const code = resp ? resp.status() : 0;
    const nameHit = new RegExp(r.product.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(body);
    if (/in queue|queue position|not yet visible|pending review|under review|awaiting|moderation/i.test(body)) verdict = "pending";
    else if (code < 400 && nameHit && !/404|not found/i.test(body)) verdict = "live";
    else verdict = "missing";
  } catch (e) { verdict = "missing"; body = (e.message || "").slice(0, 120); }
  const shot = path.join(PROOF_DIR, `audit-${r.slug}-${r.directory}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  r.audit = { status: verdict, at: now, shot };
  ({ live: () => live++, pending: () => pending++, missing: () => missing++ }[verdict] || (() => {}))();
  console.log(`${verdict === "live" ? "🟢" : verdict === "pending" ? "🟡" : "🔴"} ${r.directory.padEnd(14)} ${verdict.padEnd(8)} ${r.listingUrl}`);
}
await browser.close();
fs.writeFileSync(LEDGER, JSON.stringify(rows, null, 2));
console.log(`\naudit @ ${now}  —  🟢 ${live} live   🟡 ${pending} pending   🔴 ${missing} missing   (${skipped} no-url)`);
console.log(`ledger + screenshots: ${PROOF_DIR}`);
