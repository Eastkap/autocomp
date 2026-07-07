#!/usr/bin/env node
// browser.mjs — real-browser fetch/submit for the loop (Playwright + Chromium).
// The base browser tier: renders JS pages, reads content, fills/submits forms, screenshots.
// Escalation order (CLAUDE.md #14): plain WebFetch → TRAWL (Camoufox, CAPTCHAs; tools/trawl.md)
// → this (Playwright). Persistent profile via --profile <dir> so logins survive (OAuth dirs).
//
//   node browser/browser.mjs fetch <url> [--links] [--profile <dir>] [--state <file>] [--wait <ms>]
//   node browser/browser.mjs shot  <url> <out.png> [--profile <dir>] [--state <file>]
//
// --state <file>: reuse a session captured with login-capture.mjs (authenticated as that bot
// account — e.g. for OAuth-only directory signups). Reading the public web is ungated;
// submitting a form is an outbound action → still gated.
import { chromium } from "playwright";
import path from "node:path";

const [, , cmd, url, ...rest] = process.argv;
const opt = (f, d) => { const i = rest.indexOf(f); return i >= 0 ? (rest[i + 1] ?? true) : d; };
const has = (f) => rest.includes(f);
const profile = opt("--profile", null);
const state = opt("--state", null);
const waitMs = parseInt(opt("--wait", "0"), 10) || 0;

// returns { context, close } — close() tears down the browser process too, so node exits.
async function ctx() {
  if (profile) {
    const c = await chromium.launchPersistentContext(path.resolve(profile), { headless: true });
    return { context: c, close: () => c.close() };
  }
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext(state ? { storageState: path.resolve(state) } : {});
  return { context: c, close: () => b.close() };
}

if (!cmd || !url) {
  console.error("usage: browser.mjs fetch <url> [--links] [--profile d] [--wait ms] | shot <url> <out.png>");
  process.exit(1);
}

const { context: c, close } = await ctx();
const page = c.pages()[0] || (await c.newPage());
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (waitMs) await page.waitForTimeout(waitMs);
  if (cmd === "fetch") {
    const text = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 20000);
    console.log(text);
    if (has("--links")) {
      const links = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")].map((a) => a.href));
      console.error("\n--- LINKS ---");
      [...new Set(links)].forEach((l) => console.error(l));
    }
  } else if (cmd === "shot") {
    const out = rest[0];
    await page.screenshot({ path: out, fullPage: true });
    console.log("screenshot -> " + out);
  }
} finally {
  await close();
}
