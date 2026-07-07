#!/usr/bin/env python3
"""
agent-worker — pull-based *agentic browser* worker (worker 2).

Complements the TRAWL solve-worker. Where that one is a fetch/solve tier
(GET/POST-and-return), this one DRIVES a real logged-in browser to complete
multi-step tasks: sign-ups, form fills, "log in and do X", check a dashboard —
the interactive "act for me on the web" jobs the fetch tier can't do.

Least-privilege by design (owner's ladder, 2026-07-07):
  agentic browser (this)  →  Claude-in-Chrome MCP  →  full computer use.
This is the lowest rung: a scoped Playwright/Chromium agent on ONE browser
profile, not the whole desktop. Escalate only if a task can't be finished here.

Identity ladder: boseclaw (bot) by default. This worker only claims jobs whose
`identity` is in its own IDENTITIES list (see claim_agent_job's p_identities) —
so a bot-only box can NEVER pick up a 'personal' job. Run a personal-profile
worker only for safe, low-risk tasks, and keep risky personal-identity actions
gated upstream (enqueue them as identity='personal' only when you mean it).

Runs on the homelab (residential IP). Outbound-only: claims from Supabase, drives
a local browser, writes results back. stdlib for the queue; browser-use for the agent.
"""
import asyncio, json, os, socket, sys, traceback, urllib.request, urllib.error

SUPABASE_URL  = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY  = os.environ["SUPABASE_SECRET_KEY"]
WORKER_ID     = os.environ.get("WORKER_ID") or socket.gethostname()
IDENTITIES    = [s.strip() for s in os.environ.get("IDENTITIES", "boseclaw").split(",") if s.strip()]
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "8"))
MODEL         = os.environ.get("AGENT_MODEL", "claude-sonnet-5")
# one Chrome user-data-dir per identity, pre-logged-in (see README bootstrap)
PROFILE_DIRS  = {
    "boseclaw": os.environ.get("PROFILE_DIR_BOSECLAW", "/profiles/boseclaw"),
    "personal": os.environ.get("PROFILE_DIR_PERSONAL", "/profiles/personal"),
}
MAX_STEPS     = int(os.environ.get("MAX_STEPS", "40"))

REST = SUPABASE_URL + "/rest/v1"
HDRS = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json"}


def _req(method, url, headers, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None


def claim():
    rows = _req("POST", REST + "/rpc/claim_agent_job", HDRS,
                {"p_worker": WORKER_ID, "p_identities": IDENTITIES})
    return rows[0] if rows else None


def finish(job_id, patch):
    _req("PATCH", f"{REST}/agent_jobs?id=eq.{job_id}",
         {**HDRS, "Prefer": "return=minimal"}, patch)


def make_llm():
    """Anthropic LLM for the agent loop — try browser_use's own, fall back to langchain."""
    try:
        from browser_use import ChatAnthropic          # newer browser-use
        return ChatAnthropic(model=MODEL)
    except Exception:
        from langchain_anthropic import ChatAnthropic   # classic
        return ChatAnthropic(model=MODEL)


async def run_task(job):
    from browser_use import Agent, BrowserProfile
    profile_dir = PROFILE_DIRS.get(job["identity"])
    if not profile_dir or not os.path.isdir(profile_dir):
        return None, f"no browser profile for identity '{job['identity']}' " \
                     f"(expected a pre-logged-in dir at {profile_dir}; see README bootstrap)"

    task = job["task"]
    if job.get("start_url"):
        task = f"Go to {job['start_url']}. Then: {task}"

    agent = Agent(
        task=task,
        llm=make_llm(),
        browser=BrowserProfile(user_data_dir=profile_dir, channel="chrome"),
    )
    history = await agent.run(max_steps=MAX_STEPS)

    # extract a final answer defensively across browser-use versions
    summary = None
    for accessor in ("final_result", "final_answer"):
        fn = getattr(history, accessor, None)
        if callable(fn):
            try:
                summary = fn()
                break
            except Exception:
                pass
    if summary is None:
        summary = str(history)[:4000]
    urls = []
    try:
        urls = history.urls()[-5:]
    except Exception:
        pass
    return {"summary": summary, "identity": job["identity"], "visited": urls}, None


def process(job):
    jid = job["id"]
    print(f"[agent {WORKER_ID}] running {jid} ({job['identity']}): {job['task'][:80]}", flush=True)
    try:
        result, err = asyncio.run(run_task(job))
    except Exception as e:                              # noqa: BLE001 — surface any agent failure
        result, err = None, f"agent crashed: {e}\n{traceback.format_exc()[:800]}"
    if err:
        finish(jid, {"status": "failed", "error": err, "completed_at": "now()"})
        print(f"[agent] FAILED {jid}: {err}", file=sys.stderr, flush=True)
    else:
        finish(jid, {"status": "done", "result": result, "completed_at": "now()"})
        print(f"[agent] done {jid}", flush=True)


def main():
    import time
    print(f"[agent {WORKER_ID}] up — identities={IDENTITIES} model={MODEL} "
          f"Supabase={SUPABASE_URL}", flush=True)
    while True:
        try:
            job = claim()
        except Exception as e:                          # noqa: BLE001 — transient; back off
            print(f"[agent] claim error: {e}", file=sys.stderr, flush=True)
            time.sleep(POLL_INTERVAL); continue
        if not job:
            time.sleep(POLL_INTERVAL); continue
        process(job)


if __name__ == "__main__":
    main()
