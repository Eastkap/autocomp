// Cloudflare Email Worker — receives newsletters forwarded to newsletters@limed.tech
// and stores each parsed message into Supabase weeklybrief.inbound for the concierge brief.
import PostalMime from "postal-mime";

export default {
  async email(message, env, ctx) {
    let parsed = {};
    try {
      parsed = await PostalMime.parse(message.raw);
    } catch (e) {
      parsed = {};
    }
    const row = {
      from_addr: message.from || parsed.from?.address || null,
      from_name: parsed.from?.name || null,
      to_addr: message.to || null,
      subject: parsed.subject || message.headers.get("subject") || null,
      message_id: parsed.messageId || message.headers.get("message-id") || null,
      html: parsed.html || null,
      text_body: parsed.text || null,
      raw_size: message.rawSize || null,
    };
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/inbound`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "content-type": "application/json",
          "content-profile": "weeklybrief",
          prefer: "return=minimal",
        },
        body: JSON.stringify(row),
      });
    } catch (e) {
      // Never bounce the sender on a storage hiccup; log-and-accept.
    }
  },
};
