#!/usr/bin/env python3
"""
trawl-worker — pull-based CAPTCHA/bot-wall solver worker.

Runs on the OWNER'S HOMELAB (residential IP). Dials OUT to our Supabase, claims
`solve_jobs` rows one at a time via the atomic `claim_solve_job` RPC (FOR UPDATE
SKIP LOCKED, so two workers never grab the same job), runs each through a LOCAL
TRAWL (real Camoufox Firefox), and writes the solved HTML back to the row.

No inbound ports. No tunnel. The homelab only makes outbound HTTPS to Supabase +
localhost HTTP to TRAWL. That's the whole point: residential IP for the solve,
zero exposure of the homelab to the internet.

stdlib only — no pip install. Honest failure: a TRAWL error marks the job
`failed` with the reason so the requester is never left hanging, and never fakes
a solve (CLAUDE.md).

Env (see .env.example):
  SUPABASE_URL, SUPABASE_SECRET_KEY   — our project (server-side key; stays on the homelab)
  TRAWL_URL                            — local TRAWL (default http://trawl:8191 on the compose net)
  WORKER_ID                            — label for the claimed rows (default: hostname)
  POLL_INTERVAL                        — seconds between empty-queue polls (default 5)
  MAX_TIMEOUT_MS                       — per-solve ceiling handed to TRAWL (default 60000)
"""
import json, os, socket, sys, time, urllib.request, urllib.error

SUPABASE_URL   = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY   = os.environ["SUPABASE_SECRET_KEY"]
TRAWL_URL      = os.environ.get("TRAWL_URL", "http://trawl:8191").rstrip("/")
WORKER_ID      = os.environ.get("WORKER_ID") or socket.gethostname()
POLL_INTERVAL  = float(os.environ.get("POLL_INTERVAL", "5"))
MAX_TIMEOUT_MS = int(os.environ.get("MAX_TIMEOUT_MS", "60000"))

REST = SUPABASE_URL + "/rest/v1"
HDRS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
}


def _req(method, url, headers, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None


def claim():
    """Atomically claim one queued job, or return None if the queue is empty."""
    rows = _req("POST", REST + "/rpc/claim_solve_job", HDRS, {"p_worker": WORKER_ID})
    return rows[0] if rows else None


def complete(job_id, patch):
    _req("PATCH", f"{REST}/solve_jobs?id=eq.{job_id}",
         {**HDRS, "Prefer": "return=minimal"}, patch)


def solve(job):
    """Run one job through local TRAWL. Returns (result_dict, error_str)."""
    payload = {
        "cmd": job.get("method") or "request.get",
        "url": job["url"],
        "maxTimeout": job.get("max_timeout") or MAX_TIMEOUT_MS,
    }
    if job.get("post_data"):
        payload["postData"] = job["post_data"]
    if job.get("headers"):
        payload["headers"] = job["headers"]
    try:
        resp = _req("POST", TRAWL_URL + "/v1",
                    {"Content-Type": "application/json"}, payload,
                    timeout=(payload["maxTimeout"] / 1000) + 30)
    except urllib.error.HTTPError as e:
        return None, f"TRAWL HTTP {e.code}: {e.read().decode()[:300]}"
    except Exception as e:                      # noqa: BLE001 — surface any transport failure
        return None, f"TRAWL unreachable: {e}"

    if not resp or resp.get("status") != "ok":
        return None, f"TRAWL did not solve: {(resp or {}).get('message', 'no response')}"
    sol = resp.get("solution") or {}
    return {
        "status":    sol.get("status"),
        "response":  sol.get("response"),      # solved HTML
        "cookies":   sol.get("cookies"),
        "userAgent": sol.get("userAgent"),
        "url":       sol.get("url"),
    }, None


def main():
    print(f"[worker {WORKER_ID}] up — Supabase={SUPABASE_URL} TRAWL={TRAWL_URL} "
          f"poll={POLL_INTERVAL}s", flush=True)
    while True:
        try:
            job = claim()
        except Exception as e:                  # noqa: BLE001 — queue transient; back off and retry
            print(f"[worker] claim error: {e}", file=sys.stderr, flush=True)
            time.sleep(POLL_INTERVAL)
            continue

        if not job:
            time.sleep(POLL_INTERVAL)
            continue

        jid, url = job["id"], job["url"]
        print(f"[worker] solving {jid} {url}", flush=True)
        result, err = solve(job)
        try:
            if err:
                complete(jid, {"status": "failed", "error": err,
                               "completed_at": "now()"})
                print(f"[worker] FAILED {jid}: {err}", file=sys.stderr, flush=True)
            else:
                complete(jid, {"status": "done", "result": result,
                               "completed_at": "now()"})
                print(f"[worker] done {jid} (http {result.get('status')})", flush=True)
        except Exception as e:                  # noqa: BLE001 — don't die on a write blip
            print(f"[worker] result-write error {jid}: {e}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
