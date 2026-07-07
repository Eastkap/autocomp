// Live feed — fetch /api/live and render the loop's real activity stream.
// Presentation only: /api/live stays the raw honest ledger; this layer just makes it scan
// cleanly — pulls the "Tick N" prefix into a badge, infers a status chip from keywords, and
// folds a long task's tail into the detail line. It never rewrites or invents wording.
const feed = document.getElementById("feed");
const status = document.getElementById("feed-status");

function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s == null ? "" : s);
  return d.innerHTML;
}

// "3h ago" / "2d ago" — human, no library.
function ago(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 90) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 36) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Pull a "Tick N" / "Tick N addendum:" prefix into a badge; split an over-long headline at its
// first "; " so the punchy clause leads and the rest flows into the detail line.
function shape(task, detail) {
  let badge = null;
  let head = String(task || "").trim();
  const m = head.match(/^Tick\s+([0-9]+[a-z]?)(?:\s+addendum)?:\s*/i);
  if (m) { badge = "Tick " + m[1]; head = head.slice(m[0].length); }
  let tail = "";
  const semi = head.indexOf("; ");
  if (semi > 40 && head.length > 96) { tail = head.slice(semi + 2); head = head.slice(0, semi); }
  const extra = [tail, detail].filter(Boolean).join(" — ");
  return { badge, head, extra };
}

// Infer a status chip from the HEADLINE clause (the lead outcome), not the whole row — so a
// shipped tick that later mentions a blocker still reads as shipped. Color/scan only.
function kind(head) {
  const s = String(head || "").toLowerCase();
  if (/\bblock(ed|s|er|ing)?\b|\bfail|unsolved|captcha|cannot|can't|stall|walled\b/.test(s)) return "blocked";
  if (/\bverif|confirm|passed\b|proven\b/.test(s)) return "verified";
  if (/\blive\b|\bship|deploy|launch|releas|complete\b/.test(s)) return "shipped";
  if (/\bsubmit|posted|\bsent\b|registration/.test(s)) return "submitted";
  return "note";
}

function rowEl(e) {
  const { badge, head, extra } = shape(e.task, e.detail);
  const k = kind(head);
  const li = document.createElement("li");
  li.className = "feed-row";
  const badgeH = badge ? `<span class="feed-tick">${esc(badge)}</span>` : "";
  const extraH = extra ? `<p class="feed-detail">${esc(extra)}</p>` : "";
  li.innerHTML =
    `<div class="feed-when"><time datetime="${esc(e.at)}">${esc(ago(e.at))}</time></div>` +
    `<div class="feed-body">` +
      `<div class="feed-top">` +
        `<span class="feed-co">${esc(e.company)}</span>` +
        `<span class="feed-kind" data-kind="${k}">${k}</span>` +
        badgeH +
        `<span class="feed-actor" data-actor="${esc(e.actor)}">${esc(e.actor)}</span>` +
      `</div>` +
      `<p class="feed-task">${esc(head)}</p>` +
      extraH +
    `</div>`;
  return li;
}

async function load() {
  try {
    const r = await fetch("/api/live", { headers: { accept: "application/json" } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok || !Array.isArray(d.events)) throw new Error(d.error || "unavailable");
    feed.innerHTML = "";
    if (d.events.length === 0) { status.textContent = "no activity yet"; return; }
    d.events.forEach((e) => feed.appendChild(rowEl(e)));
    status.textContent = `${d.events.length} most recent`;
  } catch {
    status.textContent = "feed unavailable — try again shortly";
  }
}

load();
