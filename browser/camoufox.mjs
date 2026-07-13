#!/usr/bin/env node
// camoufox.mjs — authenticated real-browser actions for the loop (Camoufox / real Firefox).
// Use THIS (not browser.mjs/Chromium) whenever a login/session is involved — OAuth directory
// signups, posting, anything behind a real account (CLAUDE.md #14). --state loads a session
// captured by login-capture.mjs.
//
//   node browser/camoufox.mjs fetch <url> [--state <file>] [--links] [--wait <ms>]
//   node browser/camoufox.mjs shot  <url> <out.png> [--state <file>] [--wait <ms>]
//   node browser/camoufox.mjs act   <steps.json> [--state <file>] [--save-state <file>] [--headful]
//
// `act` runs a sequence of steps in ONE authenticated session — the default way the loop
// *does* things in the logged-in boseclaw browser (sign-ups, form fills) WITHOUT a separate
// API-keyed agent daemon. Steps file = JSON array; each object is one action:
//   {"goto":"https://…"}            navigate (waitUntil domcontentloaded)
//   {"waitFor":"<selector>"}        wait until selector is visible (20s)
//   {"fill":["<selector>","value"]} set an input's value
//   {"type":["<selector>","value"]} type key-by-key (humanized)
//   {"click":"<selector>"}          click (Playwright selector — supports text=, role=, css)
//   {"press":"Enter"} | {"press":["<sel>","Enter"]}   keyboard
//   {"select":["<selector>","value"]}                 <select> option
//   {"upload":["<file-input-selector>","/local/path"]} set a file on an <input type=file>
//   {"wait":2000}                   sleep ms
//   {"shot":"out.png"}              full-page screenshot (so Claude can SEE + decide next)
//   {"text":"<selector>"} | {"text":true}   print innerText of selector (or whole body)
//   {"url":true}                    print current URL
// Stops on the first failing step, screenshots to <steps>.fail.png, reports which step + url.
// --save-state writes the (possibly newly-authenticated) session back so a fresh directory
// login persists next time. Reading is ungated; submitting a form is an outbound action → still gated.
import { Camoufox } from "camoufox-js";
import path from "node:path";
import fs from "node:fs";

// playwright-firefox can crash its own pageError handler on some OAuth pages (Google consent):
// "Cannot read properties of undefined (reading 'url')". Swallow it so OAuth flows complete.
process.on("uncaughtException", (e) => console.error("swallowed uncaught:", (e && e.message || "").slice(0, 80)));

const [, , cmd, arg1, ...rest] = process.argv;
const opt = (f, d) => { const i = rest.indexOf(f); return i >= 0 ? (rest[i + 1] ?? true) : d; };
const has = (f) => rest.includes(f);
const state = opt("--state", null);
const saveState = opt("--save-state", null);
const headful = has("--headful");
const waitMs = parseInt(opt("--wait", "0"), 10) || 0;

const usage = "usage: camoufox.mjs fetch <url> [--state f] [--links] [--wait ms] | shot <url> <out.png> [--state f] | act <steps.json> [--state f] [--save-state f] [--headful]";
if (!cmd || !arg1) { console.error(usage); process.exit(1); }

const browser = await Camoufox({ headless: !headful, humanize: true });
const context = await browser.newContext(
  state ? { storageState: path.resolve(state), viewport: null } : { viewport: null }
);
const page = await context.newPage();
page.on("pageerror", () => {}); // don't let a page's JS error bubble into the crashy FF handler

try {
  if (cmd === "act") {
    // ---- authenticated multi-step actions ----
    const stepsPath = path.resolve(arg1);
    const steps = JSON.parse(fs.readFileSync(stepsPath, "utf8"));
    if (!Array.isArray(steps)) throw new Error("steps file must be a JSON array");
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const [verb] = Object.keys(s);
      const v = s[verb];
      const tag = `step ${i + 1}/${steps.length} ${verb}`;
      try {
        if (verb === "goto") await page.goto(v, { waitUntil: "domcontentloaded", timeout: 45000 });
        else if (verb === "waitFor") await page.waitForSelector(v, { state: "visible", timeout: 20000 });
        else if (verb === "fill") await page.fill(v[0], v[1], { timeout: 15000 });
        else if (verb === "type") await page.type(v[0], v[1], { delay: 40, timeout: 15000 });
        else if (verb === "click") await page.click(v, { timeout: 15000 });
        else if (verb === "select") await page.selectOption(v[0], v[1], { timeout: 15000 });
        else if (verb === "upload") await page.setInputFiles(v[0], v[1], { timeout: 15000 });
        else if (verb === "wait") await page.waitForTimeout(Number(v));
        else if (verb === "press") {
          if (Array.isArray(v)) await page.press(v[0], v[1]);
          else await page.keyboard.press(v);
        } else if (verb === "shot") { await page.screenshot({ path: v, fullPage: true }); }
        else if (verb === "text") {
          const t = v === true
            ? (await page.evaluate(() => document.body?.innerText || ""))
            : (await page.locator(v).first().innerText());
          console.log(`[text] ` + t.slice(0, 8000));
        } else if (verb === "url") { console.log("[url] " + page.url()); }
        else if (verb === "fields") {
          // dump every form control's selector hints so Claude can author fill/click steps
          const ctrls = await page.evaluate(() =>
            [...document.querySelectorAll("input,textarea,select,button,[role=button]")]
              .filter((el) => el.offsetParent !== null || el.type === "hidden")
              .map((el) => ({
                tag: el.tagName.toLowerCase(), type: el.type || "", name: el.name || "",
                id: el.id || "", placeholder: el.placeholder || "",
                text: (el.innerText || el.value || "").trim().slice(0, 40),
                aria: el.getAttribute("aria-label") || "",
              })));
          console.log("[fields] " + JSON.stringify(ctrls, null, 1).slice(0, 8000));
        }
        else throw new Error(`unknown verb '${verb}'`);
        console.error(`  ✓ ${tag}`);
      } catch (e) {
        const fail = stepsPath.replace(/\.json$/, "") + ".fail.png";
        await page.screenshot({ path: fail, fullPage: true }).catch(() => {});
        console.error(`  ✗ ${tag} — ${(e.message || "").slice(0, 160)}`);
        console.error(`  ↳ current url: ${page.url()}`);
        console.error(`  ↳ screenshot:  ${fail}`);
        if (saveState) await context.storageState({ path: path.resolve(saveState) }).catch(() => {});
        process.exitCode = 2;
        break;
      }
    }
    console.error(`  final url: ${page.url()}`);
    console.error(`  title:     ${await page.title().catch(() => "?")}`);
    if (saveState && process.exitCode !== 2) {
      await context.storageState({ path: path.resolve(saveState) });
      console.error(`  saved session → ${saveState}`);
    }
  } else if (cmd === "fetch") {
    await page.goto(arg1, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (waitMs) await page.waitForTimeout(waitMs);
    const text = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 20000);
    console.log(text);
    if (has("--links")) {
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
      console.error("\n--- LINKS ---");
      [...new Set(links)].forEach((l) => console.error(l));
    }
  } else if (cmd === "shot") {
    await page.goto(arg1, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (waitMs) await page.waitForTimeout(waitMs);
    await page.screenshot({ path: rest[0], fullPage: true });
    console.log("screenshot -> " + rest[0]);
  } else {
    console.error(usage);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
