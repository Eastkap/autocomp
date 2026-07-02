// Copy to config.js and fill from your Supabase project (Settings → API).
// Both values are PUBLIC-safe: the anon key is meant to live in client code;
// row-level security (schema.sql) is what protects the data. The service-role
// key must NEVER appear here — it lives only in the VPS .env for the loop.
window.AUTOCOMP_KANBAN = {
  SUPABASE_URL: "https://YOUR-PROJECT-ref.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",
};
