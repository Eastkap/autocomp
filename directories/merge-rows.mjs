#!/usr/bin/env node
// merge-rows.mjs — fold isolated per-run rows (proof/row-*.json, written by parallel subagents
// with `launch.mjs --isolated`) into the shared ledger proof/submissions.json, then delete them.
import { LEDGER, PROOF_DIR, appendLedger } from "./engine.mjs";
import fs from "node:fs";
import path from "node:path";

const rowFiles = fs.readdirSync(PROOF_DIR).filter((f) => /^row-.*\.json$/.test(f));
let merged = 0;
for (const f of rowFiles) {
  try {
    const row = JSON.parse(fs.readFileSync(path.join(PROOF_DIR, f), "utf8"));
    appendLedger(row);
    fs.unlinkSync(path.join(PROOF_DIR, f));
    merged++;
    console.log(`  merged ${row.directory}: ${row.status}`);
  } catch (e) { console.error(`  skip ${f}: ${e.message}`); }
}
const total = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")).length : 0;
console.log(`merged ${merged} row(s); ledger now ${total} rows.`);
