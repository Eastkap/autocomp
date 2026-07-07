#!/usr/bin/env python3
"""gsc.py — Google Search Console for the loop (service-account auth, headless).

Recurring SEO need: submit sitemaps, see if pages are actually indexed, and pull the
queries/impressions/clicks/position that our SEO long-tail pages earn. Reading GSC is
research → ungated (CLAUDE.md). Config lives in .env, referenced by name:

    GOOGLE_GSC_SA_FILE   path to the service-account JSON key (gitignored). REQUIRED.
                         (or GOOGLE_GSC_SA_JSON_B64 = base64 of the JSON, inline.)

If neither is set, every command exits 2 with an honest message — the caller treats GSC
as a not-yet-configured manual step and never fakes a number.

Usage:
    tools/gsc.py sites
    tools/gsc.py sitemaps        <siteUrl>
    tools/gsc.py submit-sitemap  <siteUrl> <sitemapUrl>
    tools/gsc.py analytics       <siteUrl> [--days 28] [--dim query|page|date] [--rows 25]
    tools/gsc.py inspect         <siteUrl> <pageUrl>

<siteUrl> is the exact property string in GSC: a URL-prefix like "https://brief.limed.tech/"
or a domain property like "sc-domain:limed.tech".
"""
import base64
import json
import os
import sys
import argparse
import datetime as dt

API = "https://searchconsole.googleapis.com/v1"
WMK = "https://www.googleapis.com/webmasters/v3"
SV = "https://www.googleapis.com/siteVerification/v1"
INDEXING = "https://indexing.googleapis.com/v3"
SCOPES = ["https://www.googleapis.com/auth/webmasters",
          "https://www.googleapis.com/auth/siteverification",
          "https://www.googleapis.com/auth/indexing"]


def _load_env():
    # minimal .env reader (KEY=VALUE), so this works under cron without the shell sourcing it
    root = os.path.join(os.path.dirname(__file__), "..")
    p = os.path.join(root, ".env")
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def _credentials():
    _load_env()
    info = None
    b64 = os.environ.get("GOOGLE_GSC_SA_JSON_B64", "").strip()
    path = os.environ.get("GOOGLE_GSC_SA_FILE", "").strip()
    # convention: if unset, look for the key at the standard gitignored path
    default_path = os.path.join(os.path.dirname(__file__), "..", ".secrets", "gsc-sa.json")
    if b64:
        info = json.loads(base64.b64decode(b64))
    elif path and os.path.exists(path):
        info = json.load(open(path))
    elif os.path.exists(default_path):
        info = json.load(open(default_path))
    if not info:
        sys.stderr.write(
            "gsc.py: no service-account key (set GOOGLE_GSC_SA_FILE or GOOGLE_GSC_SA_JSON_B64 "
            "in .env). GSC is a not-yet-configured manual step — not faking data.\n")
        sys.exit(2)
    from google.oauth2 import service_account  # imported late so --help works without the dep
    return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)


def _session():
    from google.auth.transport.requests import AuthorizedSession
    return AuthorizedSession(_credentials())


def _out(obj):
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def _check(r):
    if r.status_code >= 400:
        sys.stderr.write("gsc.py: API %s — %s\n" % (r.status_code, r.text[:400]))
        sys.exit(4)
    return r.json() if r.text else {}


def cmd_sites(a):
    _out(_check(_session().get(WMK + "/sites")))


def cmd_sitemaps(a):
    import urllib.parse as up
    s = up.quote(a.siteUrl, safe="")
    _out(_check(_session().get("%s/sites/%s/sitemaps" % (WMK, s))))


def cmd_submit_sitemap(a):
    import urllib.parse as up
    s = up.quote(a.siteUrl, safe="")
    feed = up.quote(a.sitemapUrl, safe="")
    r = _session().put("%s/sites/%s/sitemaps/%s" % (WMK, s, feed))
    _check(r)
    print("submitted: %s -> %s (HTTP %s)" % (a.sitemapUrl, a.siteUrl, r.status_code))


def cmd_analytics(a):
    end = dt.date.today() - dt.timedelta(days=1)          # GSC data lags ~1-3 days
    start = end - dt.timedelta(days=a.days)
    body = {
        "startDate": start.isoformat(), "endDate": end.isoformat(),
        "dimensions": [a.dim], "rowLimit": a.rows,
    }
    import urllib.parse as up
    s = up.quote(a.siteUrl, safe="")
    data = _check(_session().post("%s/sites/%s/searchAnalytics/query" % (WMK, s), json=body))
    rows = data.get("rows", [])
    summary = {"siteUrl": a.siteUrl, "range": [start.isoformat(), end.isoformat()],
               "dimension": a.dim, "rows": len(rows),
               "totals": {"clicks": sum(r.get("clicks", 0) for r in rows),
                          "impressions": sum(r.get("impressions", 0) for r in rows)},
               "top": [{"key": r["keys"][0], "clicks": r.get("clicks", 0),
                        "impressions": r.get("impressions", 0),
                        "ctr": round(r.get("ctr", 0), 4),
                        "position": round(r.get("position", 0), 1)} for r in rows]}
    _out(summary)


def cmd_sv_token(a):
    # Get the DNS TXT the loop must place to prove domain ownership (whole-domain, covers
    # every subdomain venture). Add it via Cloudflare, then call sv-verify.
    body = {"verificationMethod": "DNS_TXT",
            "site": {"type": "INET_DOMAIN", "identifier": a.domain}}
    data = _check(_session().post(SV + "/token", json=body))
    _out({"domain": a.domain, "dns_record_type": "TXT", "dns_name": a.domain,
          "dns_value": data.get("token"), "method": data.get("method")})


def cmd_sv_verify(a):
    # Complete verification (the TXT must already be live). Makes the SA a verified owner.
    body = {"site": {"type": "INET_DOMAIN", "identifier": a.domain}}
    data = _check(_session().post(SV + "/webResource?verificationMethod=DNS_TXT", json=body))
    _out({"verified": a.domain, "owners": data.get("owners", []), "id": data.get("id")})


def cmd_add_site(a):
    # Register the property in Search Console for the (now-verified) SA. Use a domain
    # property "sc-domain:limed.tech" to cover all subdomain ventures at once.
    import urllib.parse as up
    r = _session().put("%s/sites/%s" % (WMK, up.quote(a.siteUrl, safe="")))
    _check(r)
    print("added property: %s (HTTP %s)" % (a.siteUrl, r.status_code))


def cmd_inspect(a):
    body = {"inspectionUrl": a.pageUrl, "siteUrl": a.siteUrl}
    data = _check(_session().post(API + "/urlInspection/index:inspect", json=body))
    res = data.get("inspectionResult", {}).get("indexStatusResult", {})
    _out({"pageUrl": a.pageUrl,
          "verdict": res.get("verdict"), "coverageState": res.get("coverageState"),
          "lastCrawl": res.get("lastCrawlTime"), "robotsTxtState": res.get("robotsTxtState"),
          "indexingState": res.get("indexingState")})


def cmd_index(a):
    # Google Indexing API — ask Googlebot to (re)crawl each URL. Officially the Indexing API
    # supports JobPosting/BroadcastEvent only; for ordinary pages it's a widely-used nudge that
    # often triggers a crawl faster than waiting on the sitemap (same trick as goenning's
    # google-indexing-script). Requires: the SA is an OWNER of the GSC property (we are, via
    # add-site) AND the Indexing API is enabled in the Cloud project. Quota ~200 URLs/day.
    s = _session()
    ok = 0
    for url in a.urls:
        r = s.post(INDEXING + "/urlNotifications:publish",
                   json={"url": url, "type": "URL_UPDATED"})
        if r.status_code == 200:
            print("notified: %s (HTTP 200)" % url); ok += 1
        else:
            # don't abort the batch on one failure — report and continue (honest, no faking)
            print("FAILED:   %s (HTTP %s) %s" % (url, r.status_code, r.text[:200]))
    print("--- %d/%d notified ---" % (ok, len(a.urls)))
    if ok == 0:
        sys.exit(4)


def main():
    p = argparse.ArgumentParser(description="Google Search Console for the loop")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("sites")
    q = sub.add_parser("sitemaps"); q.add_argument("siteUrl")
    q = sub.add_parser("submit-sitemap"); q.add_argument("siteUrl"); q.add_argument("sitemapUrl")
    q = sub.add_parser("analytics"); q.add_argument("siteUrl")
    q.add_argument("--days", type=int, default=28); q.add_argument("--dim", default="query",
        choices=["query", "page", "date", "country", "device"]); q.add_argument("--rows", type=int, default=25)
    q = sub.add_parser("inspect"); q.add_argument("siteUrl"); q.add_argument("pageUrl")
    q = sub.add_parser("sv-token"); q.add_argument("domain")
    q = sub.add_parser("sv-verify"); q.add_argument("domain")
    q = sub.add_parser("add-site"); q.add_argument("siteUrl")
    q = sub.add_parser("index"); q.add_argument("urls", nargs="+")
    a = p.parse_args()
    try:
        {"sites": cmd_sites, "sitemaps": cmd_sitemaps, "submit-sitemap": cmd_submit_sitemap,
         "analytics": cmd_analytics, "inspect": cmd_inspect, "sv-token": cmd_sv_token,
         "sv-verify": cmd_sv_verify, "add-site": cmd_add_site, "index": cmd_index}[a.cmd](a)
    except Exception as e:  # google.auth RefreshError etc. — no stack trace to the loop
        from google.auth.exceptions import RefreshError
        if isinstance(e, RefreshError):
            sys.stderr.write(
                "gsc.py: auth failed (%s). Likely the service-account key is wrong, or the SA "
                "email hasn't been added as a user on this GSC property. Not faking data.\n"
                % (getattr(e, "args", [""])[0] or e))
            sys.exit(3)
        raise


if __name__ == "__main__":
    main()
