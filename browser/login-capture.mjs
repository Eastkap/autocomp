#!/usr/bin/env node
// login-capture.mjs — RUN THIS ON YOUR OWN MACHINE (not the VPS).
//
// Uses CAMOUFOX (a real, fingerprint-spoofed Firefox), NOT automation Chromium — because Google
// (and others) block classic automation browsers at sign-in with "this browser or app may not be
// secure". Camoufox spoofs the fingerprint at the engine level and sets no webdriver flags, so a
// human login goes through normally. (CLAUDE.md #14: reach the web like a human, Camoufox-first.)
//
// It opens a real, visible browser. You log in / create the bot account(s) the loop should use.
// Press Enter here when done and it saves the authenticated session (cookies + storage) to
// .secrets/<name>-state.json. Upload that one file to the VPS at autocomp/.secrets/; the loop
// reuses it:  node browser/browser.mjs fetch <url> --state .secrets/<name>-state.json
//
// Setup on your machine (once):
//   cd browser && npm i camoufox-js && npx camoufox-js fetch   # downloads the Camoufox binary
// Run:
//   node browser/login-capture.mjs boseclaw https://github.com/signup
import { Camoufox } from "camoufox-js";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";

const name = process.argv[2] || "session";
const startUrl = process.argv[3] || "https://accounts.google.com/";
const outDir = path.resolve(".secrets");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${name}-state.json`);

// headful + humanize so it looks and behaves like a real person's browser
const browser = await Camoufox({ headless: false, humanize: true });
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();
await page.goto(startUrl).catch(() => {});

console.log(`\n  A real (Camoufox) browser window opened at: ${startUrl}`);
console.log("  → Log in / create the account(s) you want the loop to use (Google, GitHub, …).");
console.log("  → Google won't flag it as an 'insecure browser' — Camoufox reads as a real Firefox.");
console.log("  → You can visit several sites in that same window; every login is captured.");
console.log("  → When everything's logged in, come back here and press Enter to save.\n");

await new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("  Press Enter once you're fully logged in… ", () => { rl.close(); resolve(); });
});

await context.storageState({ path: out });
await browser.close();
console.log(`\n  ✓ Saved session → ${out}`);
console.log(`  Upload it to the VPS:  scp ${out} <vps>:~/autocomp/.secrets/`);
console.log("  It holds live login cookies — it's gitignored, never commit it.\n");
