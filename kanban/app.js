// autocomp sync — kanban client. Google auth via Supabase; RLS locks rows to the
// owner email. The agent (loop) writes the same table with the service-role key.
(() => {
  const cfg = window.AUTOCOMP_KANBAN;
  if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
    document.getElementById("gate").textContent =
      "Not configured yet — copy config.example.js to config.js and fill in Supabase URL + anon key.";
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (s) => document.querySelector(s);
  const board = $("#board"), gate = $("#gate"), who = $("#who"), authBtn = $("#auth-btn");

  authBtn.addEventListener("click", async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { await sb.auth.signOut(); location.reload(); return; }
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  });

  async function render() {
    const { data, error } = await sb.from("tasks")
      .select("*").order("priority", { ascending: false }).order("updated_at", { ascending: false });
    if (error) { console.error(error); return; }
    document.querySelectorAll(".drop").forEach((d) => (d.innerHTML = ""));
    (data || []).forEach((t) => {
      const col = document.querySelector(`.col[data-status="${t.status}"] .drop`);
      if (col) col.appendChild(cardEl(t));
    });
  }

  function cardEl(t) {
    const el = document.createElement("div");
    el.className = "card";
    el.draggable = true;
    el.dataset.id = t.id;
    const pTag = t.priority >= 2 ? '<span class="tag p2">urgent</span>'
              : t.priority === 1 ? '<span class="tag p1">high</span>' : "";
    el.innerHTML = `
      <div class="t">${esc(t.title)}</div>
      <div class="meta">
        <span class="tag ${t.assignee}">${t.assignee}</span>
        ${pTag}
        <button class="del" title="delete">✕</button>
      </div>
      ${t.notes ? `<div class="note">${esc(t.notes)}</div>` : ""}`;
    el.querySelector(".del").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Delete this task?")) { await sb.from("tasks").delete().eq("id", t.id); render(); }
    });
    el.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", t.id));
    return el;
  }

  // drag-and-drop between columns -> update status; moving sets assignee to 'agent'
  document.querySelectorAll(".col .drop").forEach((drop) => {
    const status = drop.parentElement.dataset.status;
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", async (e) => {
      e.preventDefault(); drop.classList.remove("over");
      const id = e.dataTransfer.getData("text/plain");
      const assignee = status === "done" ? "human" : "agent";
      await sb.from("tasks").update({ status, assignee }).eq("id", id);
      render();
    });
  });

  $("#new-task").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#nt-title").value.trim();
    if (!title) return;
    const priority = parseInt($("#nt-priority").value, 10) || 0;
    await sb.from("tasks").insert({ title, priority, status: "todo", assignee: "agent", created_by: "human" });
    $("#nt-title").value = "";
    render();
  });

  function esc(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { gate.hidden = false; board.hidden = true; authBtn.textContent = "Sign in with Google"; return; }
    who.textContent = session.user.email;
    authBtn.textContent = "Sign out";
    gate.hidden = true; board.hidden = false;
    await render();
    sb.channel("tasks-rt").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, render).subscribe();
  }

  sb.auth.onAuthStateChange(() => boot());
  boot();
})();
