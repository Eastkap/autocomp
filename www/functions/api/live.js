// CF Pages Function — GET /api/live
// Public activity feed: the last N real events from autocomp.activity, sanitized.
// Reuses the project's Supabase bindings (SUPABASE_URL, SUPABASE_SERVICE_KEY) — same as
// /api/subscribe. Read-only; returns ONLY public-safe fields.
//
// Sanitization (belt-and-suspenders — never leak spend or internals to the public feed):
//   - drops the harness "tick cost (headless)" telemetry rows entirely,
//   - scrubs any `tokens=…` / `cost_usd=…` fragments from detail,
//   - truncates detail, exposes only {at, company, task, detail, actor}.

const JSON_H = { "content-type": "application/json", "cache-control": "public, max-age=60" };
const LIMIT = 20;

function scrub(s) {
  return String(s || "")
    .replace(/\btokens?\s*=\s*[\d,]+/gi, "")
    .replace(/\bcost_usd\s*=\s*[\d.]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 320);
}

export async function onRequestGet({ env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "not configured" }), { status: 500, headers: JSON_H });
  }
  const h = {
    apikey: env.SUPABASE_SERVICE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "accept-profile": "autocomp",
  };
  try {
    // Narrative rows only — exclude the "tick cost (headless)" telemetry rows.
    const actQ =
      `${env.SUPABASE_URL}/rest/v1/activity` +
      `?select=at,slug,task,detail,actor` +
      `&task=not.ilike.tick%20cost*` +
      `&order=at.desc&limit=${LIMIT}`;
    const [actRes, coRes] = await Promise.all([
      fetch(actQ, { headers: h }),
      fetch(`${env.SUPABASE_URL}/rest/v1/companies?select=slug,name`, { headers: h }),
    ]);
    if (!actRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: "read failed" }), { status: 502, headers: JSON_H });
    }
    const rows = await actRes.json();
    const companies = coRes.ok ? await coRes.json() : [];
    const names = Object.fromEntries(companies.map((c) => [c.slug, c.name]));

    const events = rows.map((r) => ({
      at: r.at,
      company: names[r.slug] || r.slug,
      task: scrub(r.task),
      detail: scrub(r.detail),
      actor: r.actor || "loop",
    }));
    return new Response(JSON.stringify({ ok: true, count: events.length, events }), { headers: JSON_H });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "server error" }), { status: 500, headers: JSON_H });
  }
}
