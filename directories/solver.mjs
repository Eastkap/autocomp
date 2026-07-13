// solver.mjs — 2Captcha integration for the launch flows. Detects a reCAPTCHA v2 / hCaptcha /
// Turnstile widget on the current page, pays 2Captcha to solve it (~$0.001–0.003 each), injects
// the returned token into the page's hidden response field, and lets the flow submit normally.
//
// Key lives (by name) in .secrets/captcha.env → TWOCAPTCHA_API_KEY. NEVER hardcode it.
// This is a PAID service — each solve spends a fraction of a cent. Used only for the CAPTCHA
// walls that Camoufox's fingerprint can't pass passively (image challenges).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const ENV = path.resolve(ROOT, "..", ".secrets", "captcha.env");

export function apiKey() {
  if (process.env.TWOCAPTCHA_API_KEY) return process.env.TWOCAPTCHA_API_KEY;
  try {
    const m = fs.readFileSync(ENV, "utf8").match(/^TWOCAPTCHA_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error("no TWOCAPTCHA_API_KEY — put it in .secrets/captcha.env");
}

export async function balance() {
  const r = await fetch(`https://2captcha.com/res.php?key=${apiKey()}&action=getbalance&json=1`);
  return Number((await r.json()).request);
}

// submit a captcha job to 2Captcha and poll until solved → returns the token string.
export async function solveToken({ type, sitekey, pageurl, extra = {} }) {
  const method = { recaptcha: "userrecaptcha", hcaptcha: "hcaptcha", turnstile: "turnstile" }[type];
  if (!method) throw new Error("unknown captcha type " + type);
  const p = new URLSearchParams({ key: apiKey(), method, pageurl, json: "1" });
  p.set(type === "recaptcha" ? "googlekey" : "sitekey", sitekey);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const sub = await (await fetch("https://2captcha.com/in.php", { method: "POST", body: p })).json();
  if (sub.status !== 1) throw new Error("2captcha submit failed: " + sub.request);
  const id = sub.request;
  for (let i = 0; i < 40; i++) {                 // up to ~200s (image challenges take 15–90s)
    await new Promise((r) => setTimeout(r, 5000));
    const res = await (await fetch(`https://2captcha.com/res.php?key=${apiKey()}&action=get&id=${id}&json=1`)).json();
    if (res.status === 1) return res.request;
    if (res.request !== "CAPCHA_NOT_READY") throw new Error("2captcha error: " + res.request);
  }
  throw new Error("2captcha timeout (no token in ~200s)");
}

// find a captcha widget on the page → { type, sitekey } or null.
export async function detect(page) {
  return page.evaluate(() => {
    const attr = (el, ...names) => names.map((n) => el.getAttribute(n)).find(Boolean);
    let el;
    if ((el = document.querySelector(".h-captcha[data-sitekey], [data-hcaptcha-sitekey]")))
      return { type: "hcaptcha", sitekey: attr(el, "data-sitekey", "data-hcaptcha-sitekey") };
    if ((el = document.querySelector(".cf-turnstile[data-sitekey]")))
      return { type: "turnstile", sitekey: attr(el, "data-sitekey") };
    if ((el = document.querySelector(".g-recaptcha[data-sitekey], [data-sitekey]")))
      return { type: "recaptcha", sitekey: attr(el, "data-sitekey") };
    const srcs = [...document.querySelectorAll("iframe")].map((i) => i.src || "");
    let s;
    if ((s = srcs.find((x) => /hcaptcha\.com.*sitekey=/.test(x))))
      return { type: "hcaptcha", sitekey: (s.match(/[?&]sitekey=([^&]+)/) || [])[1] };
    if ((s = srcs.find((x) => /recaptcha.*[?&]k=/.test(x))))
      return { type: "recaptcha", sitekey: (s.match(/[?&]k=([^&]+)/) || [])[1] };
    return null;
  });
}

// write the solved token into the page's hidden response field(s) + fire common callbacks.
export async function inject(page, type, token) {
  await page.evaluate(({ type, token }) => {
    const set = (sel) => document.querySelectorAll(sel).forEach((t) => { t.value = token; t.textContent = token; });
    if (type === "recaptcha") { set('#g-recaptcha-response'); set('textarea[name="g-recaptcha-response"]'); }
    if (type === "hcaptcha") { set('textarea[name="h-captcha-response"]'); set('textarea[name="g-recaptcha-response"]'); set('[name="h-captcha-response"]'); }
    if (type === "turnstile") { set('input[name="cf-turnstile-response"]'); set('textarea[name="cf-turnstile-response"]'); }
    // best-effort: fire a reCAPTCHA data-callback if the site registered one
    try {
      const w = document.querySelector(".g-recaptcha, .h-captcha");
      const cb = w && w.getAttribute("data-callback");
      if (cb && typeof window[cb] === "function") window[cb](token);
    } catch {}
  }, { type, token });
}

// one-shot: detect → solve → inject. Returns { solved, type, cost? } or { solved:false }.
export async function solveOnPage(page) {
  const d = await detect(page);
  if (!d || !d.sitekey) return { solved: false, reason: "no captcha widget/sitekey found" };
  const token = await solveToken({ type: d.type, sitekey: d.sitekey, pageurl: page.url() });
  await inject(page, d.type, token);
  return { solved: true, type: d.type, sitekey: d.sitekey };
}
