// autocomp-mail — Cloudflare Email Worker for hello@autocomp.limed.tech (the bot inbox).
// Automated mail lives on the autocomp.limed.tech SUBDOMAIN to keep the apex limed.tech
// sending reputation clean. Parses each incoming message, extracts links (directory
// confirmation links etc.), and writes a row to Supabase autocomp.inbox so the loop can
// read + click them. Human mail (apex + everything else) forwards to the owner via catch-all.
import PostalMime from "postal-mime";

// pull the confirmation/verify links out of a body; drop boilerplate/namespace noise,
// dedupe, cap length. NOISE = XML/HTML namespaces, schema URLs, and common tracking-pixel
// hosts that are never the link the loop wants to click.
const NOISE = /(^https?:\/\/(www\.)?w3\.org\/)|(schemas?\.(microsoft|openxmlformats)\.)|(\/emailOpen|\/track\/open|\.gif(\?|$))/i;
function extractLinks(text, html) {
  const hay = `${text || ""}\n${html || ""}`;
  const urls = [...hay.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)]
    .map((m) => m[0].replace(/[.,;:]+$/, "")) // strip trailing punctuation
    .filter((u) => !NOISE.test(u));
  return [...new Set(urls)].slice(0, 50);
}

// The receiving MTA (Cloudflare) stamps its own SPF/DKIM/DMARC verdict on every message it
// accepts. Storing it turns "Resend says our DNS is right" into a verdict from a server we
// do not operate — the only evidence that tells us WHY a message landed in spam. A message
// can carry several of these (one per hop), so keep them all, newest hop first.
function authResults(parsed) {
  const hdrs = Array.isArray(parsed.headers) ? parsed.headers : [];
  const found = hdrs
    .filter((h) => (h.key || "").toLowerCase() === "authentication-results")
    .map((h) => (h.value || "").trim())
    .filter(Boolean);
  return found.length ? found.join("\n").slice(0, 4000) : null;
}

export default {
  async email(message, env) {
    let parsed = {};
    try {
      parsed = await PostalMime.parse(message.raw);
    } catch (e) {
      parsed = { subject: "(unparseable)", text: "", html: "" };
    }
    const links = extractLinks(parsed.text, parsed.html);
    const row = {
      to_addr: message.to,
      from_addr: message.from,
      subject: parsed.subject || "",
      body_text: (parsed.text || "").slice(0, 100000),
      body_html: (parsed.html || "").slice(0, 200000),
      links,
      auth_results: authResults(parsed),
    };
    const insert = (r) =>
      fetch(`${env.SUPABASE_URL}/rest/v1/inbox`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Content-Profile": "autocomp",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(r),
      });

    let res = await insert(row);
    let err = res.ok ? "" : await res.text();
    // autocomp.inbox.auth_results is added by a migration that needs a Supabase PAT the loop
    // does not currently hold. Until it lands, drop the column rather than lose the mail —
    // every directory confirmation we depend on arrives through here. Retry ONLY on that
    // exact complaint, so an unrelated 400 still reports its own error.
    if (res.status === 400 && err.includes("auth_results")) {
      const { auth_results, ...withoutAuth } = row;
      res = await insert(withoutAuth);
      if (!res.ok) err = await res.text();
    }
    // On failure, reject so Cloudflare retries rather than silently dropping the mail.
    if (!res.ok) {
      throw new Error(`supabase insert ${res.status}: ${err.slice(0, 200)}`);
    }
  },
};
