#!/usr/bin/env node
// launch.mjs — submit a product to one directory (or all) and record proof.
//
//   node directories/launch.mjs <directory> --kit kits/weekly-brief.json [--headful]
//   node directories/launch.mjs --all       --kit kits/weekly-brief.json
//
// Loads the reusable boseclaw session (.secrets/boseclaw-state.json), runs the directory's
// flow, saves the session back (so every site stays logged in for next time — "hot login"),
// writes a proof screenshot + a ledger row to directories/proof/. Run audit.mjs later to
// re-check that each listing actually went live.
import { drive, appendLedger, DEFAULT_STATE, ROOT, PROOF_DIR } from "./engine.mjs";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? (argv[i + 1] ?? true) : d; };
const has = (f) => argv.includes(f);
const kitPath = opt("--kit", null);
const state = opt("--state", DEFAULT_STATE);
const headful = has("--headful");
// --isolated: for parallel subagents — DON'T touch the shared ledger or session file (race-free).
// Each run drops proof/row-<slug>-<dir>.json instead; merge them later with `node merge-rows.mjs`.
const isolated = has("--isolated");
const which = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--kit" && argv[argv.indexOf(a) - 1] !== "--state");

if (!kitPath) { console.error("need --kit <file>. e.g. node directories/launch.mjs peerpush --kit kits/weekly-brief.json"); process.exit(1); }
const kit = JSON.parse(fs.readFileSync(path.resolve(kitPath), "utf8"));

const flowsDir = path.join(ROOT, "flows");
const allFlows = fs.readdirSync(flowsDir).filter((f) => f.endsWith(".mjs")).map((f) => f.replace(/\.mjs$/, ""));
const targets = has("--all") ? allFlows : [which];
if (!has("--all") && (!which || !allFlows.includes(which))) {
  console.error(`unknown directory '${which}'. available: ${allFlows.join(", ")}`); process.exit(1);
}

for (const name of targets) {
  const flow = await import(path.join(flowsDir, `${name}.mjs`));
  process.stderr.write(`\n▶ ${kit.name} → ${name} …\n`);
  const row = await drive(flow, { kit, state, headful, saveState: isolated ? null : state });
  row.at = new Date().toISOString();
  let n;
  if (isolated) {
    fs.writeFileSync(path.join(PROOF_DIR, `row-${kit.slug}-${name}.json`), JSON.stringify(row, null, 2));
  } else {
    n = appendLedger(row);
  }
  const mark = { submitted: "✓", "already-live": "✓", queued: "✓" }[row.status] || "✗";
  console.log(`${mark} ${name}: ${row.status}${row.listingUrl ? " → " + row.listingUrl : ""}`);
  if (row.notes) console.log(`  ${row.notes}`);
  console.log(`  proof: ${row.proof}${n ? `  (ledger rows: ${n})` : "  (isolated → row file)"}`);
}
