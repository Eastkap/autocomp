#!/usr/bin/env node
// camoufox.mjs — authenticated real-browser actions for the loop (Camoufox / real Firefox).
// Use THIS (not browser.mjs/Chromium) whenever a login/session is involved — OAuth directory
// signups, posting, anything behind a real account (CLAUDE.md #14). --state loads a session
// captured by login-capture.mjs.
//
//   node browser/camoufox.mjs fetch <url> [--state <file>] [--links] [--wait <ms>]
//   node browser/camoufox.mjs shot  <url> <out.png> [--state <file>] [--wait <ms>]
//
// Reading is ungated; submitting a form / OAuth-authorizing is an outbound action → still gated.
import { Camoufox } from "camoufox-js";
import path from "node:path";

// playwright-firefox can crash its own pageError handler on some OAuth pages (Google consent):
// "Cannot read properties of undefined (reading 'url')". Swallow it so OAuth flows complete.
process.on("uncaughtException", (e) => console.error("swallowed uncaught:", (e && e.message || "").slice(0, 80)));

const [, , cmd, url, ...rest] = process.argv;
const opt = (f, d) => { const i = rest.indexOf(f); return i >= 0 ? (rest[i + 1] ?? true) : d; };
const has = (f) => rest.includes(f);
const state = opt("--state", null);
const waitMs = parseInt(opt("--wait", "0"), 10) || 0;

if (!cmd || !url) {
  console.error("usage: camoufox.mjs fetch <url> [--state f] [--links] [--wait ms] | shot <url> <out.png> [--state f]");
  process.exit(1);
}

const browser = await Camoufox({ headless: true, humanize: true });
const context = await browser.newContext(
  state ? { storageState: path.resolve(state), viewport: null } : { viewport: null }
);
const page = await context.newPage();
page.on("pageerror", () => {}); // don't let a page's JS error bubble into the crashy FF handler
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (waitMs) await page.waitForTimeout(waitMs);
  if (cmd === "fetch") {
    const text = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 20000);
    console.log(text);
    if (has("--links")) {
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
      console.error("\n--- LINKS ---");
      [...new Set(links)].forEach((l) => console.error(l));
    }
  } else if (cmd === "shot") {
    await page.screenshot({ path: rest[0], fullPage: true });
    console.log("screenshot -> " + rest[0]);
  }
} finally {
  await browser.close();
}
