// engine.mjs — shared Camoufox driver for directory-launch flows.
//
// Each directory has a flow file in ./flows/<name>.mjs exporting:
//   export const meta = { directory, home, submitUrl };
//   export default async function launch({ H, kit, proofShot }) { ...; return record; }
// where `record` is { status, listingUrl, notes } (status: submitted | already-live | queued |
// failed | blocked). The engine wraps the flow in a real logged-in Camoufox session (boseclaw),
// hands it action helpers (H), and always captures a final proof screenshot + a ledger row.
//
// Launch a product on a directory:  node directories/launch.mjs <name> --kit kits/<product>.json
// Audit every recorded submission:   node directories/audit.mjs
import { Camoufox } from "camoufox-js";
import path from "node:path";
import fs from "node:fs";
import { solveOnPage } from "./solver.mjs";

process.on("uncaughtException", (e) => console.error("swallowed:", (e && e.message || "").slice(0, 80)));

// load gitignored .secrets/*.env into process.env so flows read credentials by name (never hardcoded)
(function loadSecrets() {
  const secretsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", ".secrets");
  for (const f of ["accounts.env", "captcha.env"]) {
    try {
      for (const line of fs.readFileSync(path.join(secretsDir, f), "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {}
  }
})();

export const ROOT = path.dirname(new URL(import.meta.url).pathname);
export const PROOF_DIR = path.join(ROOT, "proof");
export const LEDGER = path.join(PROOF_DIR, "submissions.json");
export const DEFAULT_STATE = path.resolve(ROOT, "..", ".secrets", "boseclaw-state.json");

// action helpers bound to a page — the vocabulary flows are written in.
function helpers(page, proofBase) {
  let shotN = 0;
  const H = {
    page,
    goto: (u) => page.goto(u, { waitUntil: "domcontentloaded", timeout: 45000 }),
    wait: (ms) => page.waitForTimeout(ms),
    waitFor: (s, t = 20000) => page.waitForSelector(s, { state: "visible", timeout: t }),
    fill: (s, v) => page.fill(s, v, { timeout: 15000 }),
    type: (s, v) => page.type(s, v, { delay: 40, timeout: 15000 }),
    click: (s) => page.click(s, { timeout: 15000 }),
    clickIf: async (s, t = 4000) => { try { await page.click(s, { timeout: t }); return true; } catch { return false; } },
    select: (s, v) => page.selectOption(s, v, { timeout: 15000 }),
    upload: (s, f) => page.setInputFiles(s, f, { timeout: 15000 }),
    press: (k) => page.keyboard.press(k),
    url: () => page.url(),
    text: async (s) => s
      ? page.locator(s).first().innerText().catch(() => "")
      : page.evaluate(() => document.body?.innerText || ""),
    has: async (s) => (await page.locator(s).count()) > 0,
    // solve a reCAPTCHA/hCaptcha/Turnstile on the page via 2Captcha (PAID, ~$0.002). Detects the
    // widget, gets a token, injects it. Call this, then submit the form. Returns true if solved.
    solveCaptcha: async () => {
      try {
        const r = await solveOnPage(page);
        console.error(r.solved ? `  🔓 solved ${r.type} via 2captcha` : `  (no captcha to solve: ${r.reason})`);
        return r.solved;
      } catch (e) { console.error(`  ✗ captcha solve failed: ${(e.message || "").slice(0, 120)}`); return false; }
    },
    // numbered proof screenshot inside the flow (proofBase-1.png, -2.png, …)
    shot: async (label = "") => {
      const p = `${proofBase}-${++shotN}${label ? "-" + label : ""}.png`;
      await page.screenshot({ path: p, fullPage: true }).catch(() => {});
      return p;
    },
  };
  return H;
}

// run one flow in a fresh Camoufox session; always emit a proof screenshot + ledger row.
export async function drive(flow, { kit, state = DEFAULT_STATE, saveState = state, headful = false }) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const dir = flow.meta.directory;
  const proofBase = path.join(PROOF_DIR, `${kit.slug}-${dir}`);
  // make the logo available as a local file for upload-style flows (kit.logoFile)
  if (kit.logo && /^https?:/.test(kit.logo) && !kit.logoFile) {
    const lf = path.join(PROOF_DIR, `${kit.slug}-logo${path.extname(kit.logo) || ".png"}`);
    try {
      if (!fs.existsSync(lf)) {
        const r = await fetch(kit.logo);
        fs.writeFileSync(lf, Buffer.from(await r.arrayBuffer()));
      }
      kit.logoFile = lf;
    } catch { /* upload-optional flows still run without it */ }
  }
  const browser = await Camoufox({ headless: !headful, humanize: true });
  const ctx = await browser.newContext(
    state && fs.existsSync(state) ? { storageState: state, viewport: null } : { viewport: null }
  );
  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  const H = helpers(page, proofBase);
  let rec;
  try {
    rec = await flow.default({ H, kit, meta: flow.meta });
  } catch (e) {
    rec = { status: "failed", notes: (e.message || String(e)).slice(0, 300) };
  }
  // always capture a final proof screenshot of wherever we ended up
  const proof = `${proofBase}.png`;
  await page.screenshot({ path: proof, fullPage: true }).catch(() => {});
  const finalUrl = page.url();
  if (saveState) await ctx.storageState({ path: saveState }).catch(() => {});
  await browser.close();

  const row = {
    product: kit.name, slug: kit.slug, directory: dir,
    status: rec?.status || "unknown",
    listingUrl: rec?.listingUrl || null,
    finalUrl, proof, notes: rec?.notes || "",
    via: "claude-native-camoufox",
    // caller stamps `at` (engine can't call Date.now under the workflow sandbox; launch.mjs does it)
  };
  return row;
}

export function appendLedger(row) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  let all = [];
  if (fs.existsSync(LEDGER)) { try { all = JSON.parse(fs.readFileSync(LEDGER, "utf8")); } catch {} }
  // replace any prior row for the same product+directory, else append
  all = all.filter((r) => !(r.slug === row.slug && r.directory === row.directory));
  all.push(row);
  fs.writeFileSync(LEDGER, JSON.stringify(all, null, 2));
  return all.length;
}
