// Waitlist form → same-origin /api/subscribe Pages Function.
document.querySelectorAll("form.capture").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const email = input ? input.value.trim() : "";
    if (!email) return;
    const btn = form.querySelector("button");
    const label = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "…"; }
    try {
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, kind: form.dataset.kind || "managed" }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        form.innerHTML = '<p class="form-done" role="status">You’re on the list — we’ll reach out as seats open.</p>';
        return;
      }
    } catch { /* retry state below */ }
    if (btn) { btn.disabled = false; btn.textContent = label || "Try again"; }
  });
});
