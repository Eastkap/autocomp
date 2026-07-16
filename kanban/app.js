// autocomp sync — kanban client. Google auth via Supabase; RLS locks rows to the
// owner email. The agent (loop) writes the same table with the service-role key.
(() => {
  const $ = (s) => document.querySelector(s);

  // --- pure helpers (no DOM) — exposed as window.AUTOCOMP_HELPERS for headless tests ---
  // staleness threshold for the lane strip, in hours. MUST match the U7 watchdog's
  // WATCHDOG_MAX_HOURS default (8) — UI and watchdog must agree on what "stale" means.
  const LANE_STALE_HOURS = 8;
  const helpers = {
    LANE_STALE_HOURS,
    // glanceable flag: does the HUMAN need to act, or is the loop handling it?
    needsYou: (t) => t.assignee === "human" && t.status !== "done",
    // board filter: needs-you toggle ANDs with the tag chips; tags are OR among themselves.
    // No tags selected + toggle off = everything passes (legacy cards with tags []/null too).
    cardMatches(t, f) {
      if (f.needsYou && !this.needsYou(t)) return false;
      if (f.tags && f.tags.size && !(t.tags || []).some((x) => f.tags.has(x))) return false;
      return true;
    },
    // short relative time; null/invalid -> "—"
    relTime(iso, nowMs) {
      if (!iso) return "—";
      const ms = nowMs - +new Date(iso);
      if (isNaN(ms)) return "—";
      const m = Math.round(ms / 60000);
      if (m < 1) return "just now";
      if (m < 60) return m + "m ago";
      const h = Math.round(m / 60);
      if (h < 48) return h + "h ago";
      return Math.round(h / 24) + "d ago";
    },
    // lane pill state. paused is deliberate -> never marked stale; a lane that has
    // never cycled (pre-cutover) is "idle", not dead.
    laneState(row, nowMs) {
      if ((row.last_status || "") === "paused") return "paused";
      if (!row.last_cycle_at) return "idle";
      const ageH = (nowMs - +new Date(row.last_cycle_at)) / 3600000;
      return ageH > LANE_STALE_HOURS ? "stale" : "ok";
    },
  };
  if (typeof window !== "undefined") window.AUTOCOMP_HELPERS = helpers;

  const board = $("#board"), gate = $("#gate"), who = $("#who"), authBtn = $("#auth-btn");
  const fail = (msg) => { gate.hidden = false; gate.textContent = msg; };

  if (!window.supabase) {
    fail("Couldn't load the Supabase library (blocked or offline) — reload, or whitelist this site in your content blocker.");
    return;
  }
  const cfg = window.AUTOCOMP_KANBAN;
  if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
    fail("Not configured yet — copy config.example.js to config.js and fill in Supabase URL + anon key.");
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
      // single-user board: skip navigator.locks — a suspended mobile tab holding the lock
      // makes getSession() hang forever, which reads as a dead sign-in button.
      lock: (_name, _timeout, fn) => fn(),
    },
  });

  // Session state is tracked here so the tap handler never awaits auth internals.
  let currentSession = null;

  authBtn.addEventListener("click", () => {
    authBtn.disabled = true;
    if (currentSession) {
      authBtn.textContent = "Signing out…";
      sb.auth.signOut().finally(() => location.reload());
      return;
    }
    authBtn.textContent = "Redirecting…";
    sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    }).then(({ error }) => { if (error) throw error; })
      .catch((err) => {
        authBtn.disabled = false; authBtn.textContent = "Sign in with Google";
        fail("Sign-in failed: " + (err && err.message ? err.message : err));
      });
  });

  // --- board filter state (session-only; resets on reload by design) ---
  const filterBar = $("#filters"), noMatch = $("#no-match");
  const filter = { tags: new Set(), needsYou: false };
  const cssSafe = (s) => (s || "").replace(/[^a-z0-9_-]/gi, "");

  function renderFilters(tasks) {
    if (!filterBar) return;
    const present = [...new Set(tasks.flatMap((t) => t.tags || []))].sort();
    [...filter.tags].forEach((x) => { if (!present.includes(x)) filter.tags.delete(x); });
    filterBar.innerHTML = "";
    const mk = (label, on, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fchip " + cls + (on ? " on" : "");
      b.textContent = label;
      b.addEventListener("click", fn);
      filterBar.appendChild(b);
    };
    mk("▶ needs you", filter.needsYou, "needs", () => { filter.needsYou = !filter.needsYou; render(); });
    present.forEach((tag) => mk(tag, filter.tags.has(tag), "role role-" + cssSafe(tag), () => {
      if (filter.tags.has(tag)) filter.tags.delete(tag); else filter.tags.add(tag);
      render();
    }));
    if (filter.needsYou || filter.tags.size) {
      mk("clear ✕", false, "clear", () => { filter.needsYou = false; filter.tags.clear(); render(); });
    }
    filterBar.hidden = false;
  }

  async function render() {
    const { data, error } = await sb.from("tasks")
      .select("*").order("priority", { ascending: false }).order("updated_at", { ascending: false });
    if (error) { console.error(error); return; }
    const tasks = data || [];
    renderFilters(tasks);
    document.querySelectorAll(".drop").forEach((d) => (d.innerHTML = ""));
    let shown = 0;
    tasks.forEach((t) => {
      if (!helpers.cardMatches(t, filter)) return;
      const col = document.querySelector(`.col[data-status="${t.status}"] .drop`);
      if (col) { col.appendChild(cardEl(t)); shown++; }
    });
    if (noMatch) noMatch.hidden = !((filter.needsYou || filter.tags.size) && shown === 0);
    // Lane heartbeats change hours apart — refresh the strip at most once a minute,
    // not on every task event (a multi-card lane cycle bursts several events).
    if (Date.now() - lastLanesFetch > 60000) { lastLanesFetch = Date.now(); renderLanes(); }
  }
  let lastLanesFetch = 0;

  // A lane cycle PATCHing several cards fires one realtime event per card; coalesce
  // the burst into a single re-render instead of N full tasks+lanes fetches.
  let renderTimer = null;
  function renderSoon() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 300); }

  // count unchecked "- [ ] ..." subquests in a note
  const openTodos = (notes) => (notes ? (notes.match(/^\s*[-*]\s+\[ \]/gm) || []).length : 0);
  // count unanswered "- [?] ..." approval items in a note
  const openDecisions = (notes) => (notes ? (notes.match(/^\s*[-*]\s+\[\?\]/gm) || []).length : 0);

  function cardEl(t) {
    const el = document.createElement("div");
    el.className = "card";
    el.draggable = true;
    el.dataset.id = t.id;
    const pTag = t.priority >= 2 ? '<span class="tag p2">urgent</span>'
              : t.priority === 1 ? '<span class="tag p1">high</span>' : "";
    const needsYou = helpers.needsYou(t);
    const todos = openTodos(t.notes), decs = openDecisions(t.notes);
    let flag = "";
    if (t.status === "done") {
      flag = '<span class="flag ok">done</span>';
    } else if (needsYou) {
      el.classList.add("needs-you");
      const bits = [];
      if (decs) bits.push(`${decs} to approve`);
      if (todos) bits.push(`${todos} to-do${todos > 1 ? "s" : ""}`);
      flag = `<span class="flag you">▶ your move${bits.length ? " · " + bits.join(" · ") : ""}</span>`;
    } else {
      el.classList.add("loop-on");
      flag = '<span class="flag loop">loop’s on it · nothing for you</span>';
    }
    // role-lane chips (tags text[]); legacy cards with []/null render exactly as before
    const roleChips = (t.tags || []).map((x) => `<span class="tag role role-${cssSafe(x)}">${esc(x)}</span>`).join("");
    // review cards show who claimed the check (e.g. "qa ✓ checking")
    const claimed = t.status === "review" && t.claimed_by
      ? `<span class="tag claimed">${esc(t.claimed_by)} ✓ checking</span>` : "";
    el.innerHTML = `
      ${flag}
      <div class="t">${esc(t.title)}</div>
      <div class="meta">
        ${pTag}${roleChips}${claimed}
        <button class="del" title="delete">✕</button>
      </div>
      ${(() => {
        // preview = the plain "what/where" prose, minus checklist/approval lines (the flag already counts them)
        const p = (t.notes || "").split("\n").filter((l) => !/^\s*[-*]\s+\[[ xXyYnN?]\]/.test(l) && l.trim()).join(" ").trim();
        return p ? `<div class="note">${esc(p)}</div>` : "";
      })()}`;
    el.querySelector(".del").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Delete this task?")) { await sb.from("tasks").delete().eq("id", t.id); render(); }
    });
    el.addEventListener("dragstart", (e) => { dragging = true; e.dataTransfer.setData("text/plain", t.id); });
    el.addEventListener("dragend", () => { setTimeout(() => (dragging = false), 0); });
    // click the card (not the ✕, not the tail of a drag) -> open the detail view
    el.addEventListener("click", (e) => { if (e.target.closest(".del") || dragging) return; openModal(t); });
    return el;
  }

  // --- card detail modal (Trello-style: click a card to see full notes + move it) ---
  const modal = $("#modal");
  const STATUSES = [["todo", "To do"], ["doing", "Doing"], ["review", "Review"], ["blocked", "Blocked"], ["done", "Done"]];
  let dragging = false;
  const closeModal = () => { modal.hidden = true; document.body.classList.remove("modal-open"); };
  function openModal(t) {
    $(".m-title").textContent = t.title || "(untitled)";
    const pr = t.priority >= 2 ? '<span class="tag p2">urgent</span>'
            : t.priority === 1 ? '<span class="tag p1">high</span>'
            : '<span class="tag">normal</span>';
    $(".m-badges").innerHTML =
      `<span class="tag ${t.assignee}">${esc(t.assignee)}</span>` +
      `<span class="tag st-${t.status}">${esc(t.status)}</span>${pr}` +
      (t.tags || []).map((x) => `<span class="tag role role-${cssSafe(x)}">${esc(x)}</span>`).join("") +
      (t.status === "review" && t.claimed_by ? `<span class="tag claimed">${esc(t.claimed_by)} ✓ checking</span>` : "");
    // instant "do I need to act?" banner
    const cta = $(".m-cta");
    const todos = openTodos(t.notes), decs = openDecisions(t.notes);
    if (t.status === "done") {
      cta.className = "m-cta ok"; cta.textContent = "✓ Done.";
    } else if (t.assignee === "human") {
      cta.className = "m-cta you";
      const bits = [];
      if (decs) bits.push(`${decs} to approve or reject`);
      if (todos) bits.push(`${todos} thing${todos > 1 ? "s" : ""} to do`);
      cta.textContent = bits.length ? `▶ Your move — ${bits.join(" + ")} below.` : "▶ Your move — see below.";
    } else {
      cta.className = "m-cta loop";
      cta.textContent = "🤖 The loop is handling this — nothing needed from you right now.";
    }
    renderNote(t);
    const mv = $(".m-move");
    mv.innerHTML = '<span class="m-move-lbl">Move to</span>';
    STATUSES.filter(([s]) => s !== t.status).forEach(([s, label]) => {
      const b = document.createElement("button");
      b.className = "btn move"; b.type = "button"; b.textContent = label;
      b.addEventListener("click", async () => {
        const assignee = s === "done" ? "human" : "agent";
        await sb.from("tasks").update({ status: s, assignee }).eq("id", t.id);
        closeModal(); render();
      });
      mv.appendChild(b);
    });
    const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");
    $(".m-meta").textContent =
      `created by ${t.created_by || "?"} · ${fmt(t.created_at)}` +
      (t.updated_at ? ` · updated ${fmt(t.updated_at)}` : "");
    $(".m-del").onclick = async () => {
      if (confirm("Delete this task?")) { await sb.from("tasks").delete().eq("id", t.id); closeModal(); render(); }
    };
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }
  modal.querySelectorAll("[data-close]").forEach((x) => x.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  // Render notes; markdown checkbox lines ("- [ ] step") become a tickable checklist (subquests),
  // and approval lines ("- [?] item") become Approve/Reject rows ("- [y]" / "- [n]" once answered).
  // Toggling rewrites just that line back into notes so the human can act from their phone.
  const RE_CHECK = /^(\s*)([-*])\s+\[([ xXyYnN?])\]\s+(.*)$/;

  // save notes; approval cards self-move: all items answered (no "[ ]"/"[?]" left) -> done,
  // an undo on a done card -> back to todo. Plain-checklist cards keep their manual flow.
  async function saveDecisions(t) {
    const upd = { notes: t.notes };
    if (/^\s*[-*]\s+\[[yYnN?]\]/m.test(t.notes)) {
      const open = (t.notes.match(/^\s*[-*]\s+\[[ ?]\]/gm) || []).length;
      if (!open && t.status !== "done") { upd.status = "done"; upd.assignee = "human"; }
      else if (open && t.status === "done") { upd.status = "todo"; upd.assignee = "human"; }
    }
    await sb.from("tasks").update(upd).eq("id", t.id);
    if (upd.status) { t.status = upd.status; t.assignee = upd.assignee; }
  }

  // approval item: "[?]" pending -> Approve/Reject; "[y]"/"[n]" answered -> badge, tap to undo
  function decisionRow(t, m, i) {
    const mark = m[3].toLowerCase();
    const row = document.createElement("div");
    row.className = "dec" + (mark === "y" ? " yes" : mark === "n" ? " no" : "");
    const txt = document.createElement("div");
    txt.className = "dec-txt"; txt.textContent = m[4];
    const setMark = async (nm) => {
      const arr = t.notes.split("\n");
      arr[i] = `${m[1]}${m[2]} [${nm}] ${m[4]}`;
      t.notes = arr.join("\n");
      await saveDecisions(t);
      openModal(t); render();
    };
    const btns = document.createElement("div");
    btns.className = "dec-btns";
    if (mark === "?") {
      const yes = document.createElement("button");
      yes.type = "button"; yes.className = "btn dec-yes"; yes.textContent = "✓ Approve";
      yes.addEventListener("click", () => setMark("y"));
      const no = document.createElement("button");
      no.type = "button"; no.className = "btn dec-no"; no.textContent = "✗ Reject";
      no.addEventListener("click", () => setMark("n"));
      btns.append(yes, no);
    } else {
      const undo = document.createElement("button");
      undo.type = "button"; undo.className = "btn dec-undo";
      undo.textContent = mark === "y" ? "✓ approved · undo" : "✗ rejected · undo";
      undo.addEventListener("click", () => setMark("?"));
      btns.append(undo);
    }
    row.appendChild(txt); row.appendChild(btns);
    return row;
  }

  function renderNote(t) {
    const box = $(".m-note");
    box.innerHTML = "";
    const raw = t.notes || "";
    if (!raw.trim()) { box.textContent = "No notes yet."; box.classList.add("empty"); return; }
    box.classList.remove("empty");
    const lines = raw.split("\n");
    if (!lines.some((l) => RE_CHECK.test(l))) { box.textContent = raw; return; } // plain notes
    const total = lines.filter((l) => RE_CHECK.test(l)).length;
    const doneN = lines.filter((l) => { const m = l.match(RE_CHECK); return m && "xyn".includes(m[3].toLowerCase()); }).length;
    const prog = document.createElement("div");
    prog.className = "chk-prog"; prog.textContent = `${doneN}/${total} done`;
    box.appendChild(prog);
    lines.forEach((line, i) => {
      const m = line.match(RE_CHECK);
      if (m) {
        const mark = m[3].toLowerCase();
        if (mark !== " " && mark !== "x") { box.appendChild(decisionRow(t, m, i)); return; }
        const row = document.createElement("label");
        row.className = "chk" + (mark === "x" ? " done" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = mark === "x";
        const span = document.createElement("span"); span.textContent = m[4];
        cb.addEventListener("change", async () => {
          const arr = t.notes.split("\n");
          arr[i] = `${m[1]}${m[2]} [${cb.checked ? "x" : " "}] ${m[4]}`;
          t.notes = arr.join("\n");
          await saveDecisions(t);
          openModal(t); render();
        });
        row.appendChild(cb); row.appendChild(span);
        box.appendChild(row);
      } else if (line.trim()) {
        const p = document.createElement("div"); p.className = "note-line"; p.textContent = line;
        box.appendChild(p);
      }
    });
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

  // --- Ticks view: the registry activity log (autocomp schema, owner-locked RLS).
  // Shows every run of the company — cron ticks (actor=loop), interactive sessions
  // (actor=cofounder), role subagents — with measured cost rows folded in as badges.
  const ticksMain = $("#ticks"), ticksList = $("#ticks-list"), tabs = $("#tabs");
  let view = "board";
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (!b || b.dataset.view === view) return;
    view = b.dataset.view;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t === b));
    board.hidden = view !== "board";
    ticksMain.hidden = view !== "ticks";
    if (view === "ticks") renderTicks();
  });

  async function fetchActivity() {
    // raw REST: the supabase-js client is bound to the public schema; activity lives in
    // the `autocomp` schema, selected via profile header. Auth = the signed-in session JWT.
    const r = await fetch(cfg.SUPABASE_URL +
      "/rest/v1/activity?order=at.desc&limit=200&select=at,slug,task,detail,actor,tokens,cost_usd", {
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + currentSession.access_token,
        "Accept-Profile": "autocomp",
      },
    });
    if (!r.ok) throw new Error("activity fetch failed: " + r.status);
    return r.json();
  }

  async function renderTicks() {
    ticksList.innerHTML = '<p class="ticks-intro">Loading…</p>';
    let rows;
    try { rows = await fetchActivity(); }
    catch (err) { ticksList.innerHTML = '<p class="ticks-intro">Couldn’t load ticks: ' + esc(err.message) + "</p>"; return; }
    // fold harness cost rows into the nearest same-slug work row within 30 min
    const work = rows.filter((r) => r.actor !== "harness");
    rows.filter((r) => r.actor === "harness").forEach((c) => {
      const t = +new Date(c.at);
      let best = null, bestGap = 30 * 60 * 1000;
      work.forEach((w) => {
        const gap = Math.abs(t - +new Date(w.at));
        if (w.slug === c.slug && gap < bestGap) { best = w; bestGap = gap; }
      });
      if (best) { best._tokens = c.tokens; best._cost = c.cost_usd; }
      else work.push(c); // unmatched cost row: show it as-is, never hide data
    });
    work.sort((a, b) => new Date(b.at) - new Date(a.at));
    ticksList.innerHTML = "";
    let lastDay = "";
    work.forEach((r) => {
      const d = new Date(r.at);
      const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      if (day !== lastDay) {
        lastDay = day;
        const h = document.createElement("h2");
        h.className = "tick-day"; h.textContent = day;
        ticksList.appendChild(h);
      }
      const row = document.createElement("div");
      row.className = "tick";
      const actor = r.actor === "loop" ? "cron tick" : r.actor || "?";
      const cost = r._cost != null ? `<span class="tag cost">$${(+r._cost).toFixed(2)} · ${Math.round((r._tokens || 0) / 1000)}k tok</span>`
                 : r.cost_usd != null ? `<span class="tag cost">$${(+r.cost_usd).toFixed(2)} · ${Math.round((r.tokens || 0) / 1000)}k tok</span>` : "";
      row.innerHTML =
        `<div class="tick-head">` +
        `<span class="tick-time">${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>` +
        `<span class="tag slug">${esc(r.slug)}</span>` +
        `<span class="tag actor ${esc(r.actor)}">${esc(actor)}</span>` +
        cost + `</div>` +
        `<div class="tick-task">${esc(r.task)}</div>` +
        (r.detail ? `<div class="tick-detail">${esc(r.detail)}</div>` : "");
      const det = row.querySelector(".tick-detail");
      if (det && r.detail && r.detail.length > 160) {
        det.classList.add("clamp");
        det.addEventListener("click", () => det.classList.toggle("clamp"));
      }
      ticksList.appendChild(row);
    });
    if (!work.length) ticksList.innerHTML = '<p class="ticks-intro">No activity logged yet.</p>';
  }

  // --- lane-status strip: liveness of the role lanes (autocomp.lanes, owner-locked RLS).
  // Raw REST with Accept-Profile, same pattern as the Ticks tab. Empty/unreadable table
  // (pre-migration, RLS-filtered, signed out) -> strip hidden, never an error.
  const laneStrip = $("#lane-strip");
  async function fetchLanes() {
    const r = await fetch(cfg.SUPABASE_URL +
      "/rest/v1/lanes?order=lane&select=lane,last_cycle_at,last_status", {
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + currentSession.access_token,
        "Accept-Profile": "autocomp",
      },
    });
    if (!r.ok) throw new Error("lanes fetch failed: " + r.status);
    return r.json();
  }

  async function renderLanes() {
    if (!laneStrip) return;
    if (!currentSession) { laneStrip.hidden = true; return; }
    let rows;
    try { rows = await fetchLanes(); }
    catch (_) { laneStrip.hidden = true; return; }
    if (!Array.isArray(rows) || !rows.length) { laneStrip.hidden = true; return; }
    const now = Date.now();
    laneStrip.innerHTML = rows.map((l) => {
      const st = helpers.laneState(l, now);
      const label = st === "paused" ? "paused"
                  : st === "idle" ? "not started"
                  : st === "stale" ? `stale · last ${helpers.relTime(l.last_cycle_at, now)}`
                  : `${helpers.relTime(l.last_cycle_at, now)}${l.last_status ? " · " + esc(l.last_status) : ""}`;
      return `<span class="lane ${st}"><b>${esc(l.lane)}</b><span class="lane-st">${label}</span></span>`;
    }).join("");
    laneStrip.hidden = false;
  }

  let rtChannel = null;
  async function boot(session) {
    currentSession = session;
    authBtn.disabled = false;
    if (!session) {
      gate.hidden = false; board.hidden = true;
      ticksMain.hidden = true; tabs.hidden = true;
      if (laneStrip) laneStrip.hidden = true;
      if (filterBar) filterBar.hidden = true;
      authBtn.textContent = "Sign in with Google";
      who.textContent = "";
      return;
    }
    who.textContent = session.user.email;
    authBtn.textContent = "Sign out";
    gate.hidden = true; tabs.hidden = false;
    board.hidden = view !== "board";
    ticksMain.hidden = view !== "ticks";
    if (view === "ticks") renderTicks();
    await render();
    if (!rtChannel) {
      rtChannel = sb.channel("tasks-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, renderSoon)
        .subscribe();
    }
  }

  // onAuthStateChange fires INITIAL_SESSION on load and hands us the session directly —
  // no getSession() in any hot path. If it hasn't fired within 4s, assume stale/corrupt
  // stored auth, clear it, and show the signed-out state instead of hanging.
  let booted = false;
  sb.auth.onAuthStateChange((_event, session) => { booted = true; boot(session); });
  setTimeout(() => {
    if (booted) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-"))
        .forEach((k) => localStorage.removeItem(k));
    } catch (_) { /* storage unavailable — nothing to clear */ }
    boot(null);
  }, 4000);
})();
