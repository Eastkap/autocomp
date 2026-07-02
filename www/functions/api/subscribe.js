// CF Pages Function — POST /api/subscribe
// Managed-tier waitlist capture → Supabase autocomp.waitlist (server-side, service key).
// Secrets (Pages project env): SUPABASE_URL, SUPABASE_SERVICE_KEY.

const JSON_H = { "content-type": "application/json" };

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid email" }), { status: 400, headers: JSON_H });
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "not configured" }), { status: 500, headers: JSON_H });
    }
    const row = {
      email,
      kind: body.kind === "selfhosted-updates" ? "selfhosted-updates" : "managed",
      note: String(body.note || "").slice(0, 1000),
    };
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "content-type": "application/json",
        "content-profile": "autocomp",
        prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (res.ok || res.status === 409) {
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_H });
    }
    return new Response(JSON.stringify({ ok: false, error: "store failed" }), { status: 502, headers: JSON_H });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "server error" }), { status: 500, headers: JSON_H });
  }
}
