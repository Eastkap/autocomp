// verify-email.mjs — one-off: open boseclaw's Gmail, find the SaaSHub "Verify your email"
// message, extract the confirmation link, and hit it to verify the account. Saves session.
import { Camoufox } from "camoufox-js";
import path from "node:path";
process.on("uncaughtException", () => {});
const STATE = path.resolve("../.secrets/boseclaw-state.json");

const browser = await Camoufox({ headless: true, humanize: true });
const ctx = await browser.newContext({ storageState: STATE, viewport: null });
const page = await ctx.newPage();
page.on("pageerror", () => {});

await page.goto("https://mail.google.com/mail/u/0/#search/from%3Asaashub+verify", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
// open the newest "Verify your email" message
await page.locator("tr:has-text('Verify your email')").first().click({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(6000);

// extract any saashub.com confirmation link in the open email
const links = await page.evaluate(() =>
  [...document.querySelectorAll("a")].map((a) => a.href)
    .filter((h) => /saashub\.com/.test(h))
);
console.log("saashub links:", JSON.stringify(links, null, 1));
// unwrap Google's redirect wrapper if present
let confirm = links.find((h) => /confirmation|confirm|verif|token/i.test(h)) || links[0];
if (confirm && /google\.com\/url\?/.test(confirm)) {
  const u = new URL(confirm);
  confirm = decodeURIComponent(u.searchParams.get("q") || u.searchParams.get("url") || confirm);
}
console.log("→ confirm URL:", confirm);

if (confirm) {
  await page.goto(confirm, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "proof/email-verified.png", fullPage: true }).catch(() => {});
  const body = await page.evaluate(() => document.body?.innerText || "");
  console.log("after-confirm url:", page.url());
  console.log("after-confirm body:", body.replace(/\n+/g, " ").slice(0, 400));
}
await ctx.storageState({ path: STATE }).catch(() => {});
await browser.close();
