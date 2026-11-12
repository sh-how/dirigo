"""Build design/sample-data.json and check it against the rules in docs/04-data-and-rules.md."""
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path

out = Path(sys.argv[1])
TODAY = date(2026, 11, 11)
VIEWER = "you"
SETTINGS = {
    "review_target_days": 2,
    "stalled_after_days": 5,
    "failing_checks_block_after_days": 1,
    "pace_window_days": 14,
    "in_progress_rule": "linked_pull_request",
}


def d(month, day, year=2026):
    return date(year, month, day).isoformat()


def issue(repo, number, title, assignees, created, labels=(), milestone=None, linked_pr=None, last_activity=None):
    return {
        "repository": repo, "number": number, "kind": "issue", "title": title,
        "labels": list(labels), "assignees": list(assignees), "created": created,
        "last_activity": last_activity or created, "milestone": milestone,
        "linked_open_pull_request": linked_pr,
    }


def pr(repo, number, title, author, decision, checks, last_activity, milestone=None, draft=False,
       requested=(), waiting_since=None, failing_since=None, changes_requested_by=None):
    return {
        "repository": repo, "number": number, "kind": "pull_request", "title": title,
        "author": author, "draft": draft, "review_decision": decision,
        "requested_reviewers": list(requested), "changes_requested_by": changes_requested_by,
        "checks": checks, "checks_failing_since": failing_since,
        "waiting_since": waiting_since, "last_activity": last_activity, "milestone": milestone,
    }


L, A, W, K = "lattice-db/lattice", "northwind/api", "northwind/web-app", "papertrail-ui/kit"

items = [
    # lattice
    issue(L, 482, "Compaction stalls when the log exceeds 4 GB", [], d(11, 8), ["bug"], "v0.9"),
    issue(L, 476, "Range scan returns duplicates after a split", [], d(11, 3), ["bug"], "v0.9"),
    issue(L, 470, "Expose compaction metrics", ["J. Lin"], d(10, 28), ["enhancement"]),
    issue(L, 467, "Streaming snapshot restore", ["M. Tanaka"], d(10, 20), [], "v0.9", 490, d(11, 10)),
    issue(L, 459, "Reduce write stalls under load", ["J. Lin"], d(10, 14), [], "v0.9", 479, d(11, 8)),
    pr(L, 479, "Parallelise segment merges", "J. Lin", "REVIEW_REQUIRED", "passing", d(11, 5), "v0.9",
       requested=["M. Tanaka"], waiting_since=d(11, 5)),
    pr(L, 491, "Bound memory use during range scans", "J. Lin", "REVIEW_REQUIRED", "passing", d(11, 7), "v0.9",
       requested=[VIEWER], waiting_since=d(11, 7)),
    pr(L, 493, "Bump test fixtures", "J. Lin", "APPROVED", "passing", d(11, 10)),
    pr(L, 488, "Document the on-disk format v3", "M. Tanaka", "CHANGES_REQUESTED", "passing", d(11, 9),
       waiting_since=d(11, 9), changes_requested_by="J. Lin"),
    pr(L, 490, "Snapshot restore", "M. Tanaka", None, "none", d(11, 10), draft=True),
    # api
    issue(A, 1207, "Rate limiter ignores per-tenant overrides", [], d(11, 4), ["bug"], "November release"),
    issue(A, 1201, "Paginate the audit log endpoint", ["C. Okafor"], d(10, 28)),
    issue(A, 1198, "Return a conflict error on duplicate invoices", [VIEWER], d(10, 21)),
    issue(A, 1189, "Move webhook retries to the job queue", [VIEWER], d(10, 19), [], "November release", 1214, d(11, 11)),
    issue(A, 1175, "Rotate signing keys without downtime", ["C. Okafor"], d(10, 12), [], None, 1209, d(11, 9)),
    pr(A, 1210, "Add idempotency keys to payment endpoints", VIEWER, "REVIEW_REQUIRED", "passing", d(11, 9),
       "November release", requested=["C. Okafor"], waiting_since=d(11, 9)),
    pr(A, 1214, "Webhook retries on the job queue", VIEWER, None, "failing", d(11, 9), "November release",
       draft=True, failing_since=d(11, 9)),
    pr(A, 1212, "Upgrade the database client", "C. Okafor", "APPROVED", "passing", d(11, 10)),
    pr(A, 1209, "Rotate signing keys: accept both keys", "C. Okafor", "CHANGES_REQUESTED", "passing", d(11, 8),
       waiting_since=d(11, 8), changes_requested_by=VIEWER),
    # web-app
    issue(W, 751, "Dark mode flickers on first load", [], d(11, 9), ["bug"]),
    issue(W, 748, "Export invoices as a spreadsheet", ["P. Nair"], d(11, 4), ["enhancement"]),
    issue(W, 739, "Keyboard shortcuts for the inbox", ["P. Nair"], d(10, 21), ["enhancement"]),
    issue(W, 733, "Billing page: replace polling with server events", [VIEWER], d(10, 26), [], "Q4 polish", 744, d(11, 11)),
    pr(W, 744, "Billing page: server events instead of polling", VIEWER, "CHANGES_REQUESTED", "passing", d(11, 9),
       "Q4 polish", waiting_since=d(11, 9), changes_requested_by="P. Nair"),
    pr(W, 741, "Upgrade router and remove legacy redirects", "P. Nair", "APPROVED", "passing", d(11, 10)),
    # kit
    issue(K, 94, "Tooltip clips at the viewport edge", [], d(11, 6), ["bug"]),
    issue(K, 96, "Date picker should accept ISO week numbers", ["A. Rao"], d(10, 28), ["enhancement"]),
    issue(K, 90, "Add a skeleton loader component", ["A. Rao"], d(10, 11), ["enhancement"]),
    issue(K, 88, "Rework the tabs component for overflow", ["A. Rao"], d(10, 22), [], "v2.0", 99, d(11, 10)),
    pr(K, 101, "Fix focus trap in nested dialogs", "A. Rao", "REVIEW_REQUIRED", "passing", d(11, 10), "v2.0",
       requested=[VIEWER], waiting_since=d(11, 10)),
    pr(K, 99, "Tabs: scroll when they overflow", "A. Rao", None, "none", d(11, 10), draft=True),
]

# Details shown in the mockups that the rules do not use: files changed (Reviews) and
# the number of failing checks (Today, All work).
FILES_CHANGED = {479: 11, 491: 6, 493: 2, 488: 3, 490: 9, 1210: 4, 1214: 7, 1212: 2, 1209: 5, 744: 8, 741: 14, 101: 3, 99: 4}
FAILING_CHECKS = {1214: 2}
for it in items:
    if it["kind"] == "pull_request":
        it["files_changed"] = FILES_CHANGED[it["number"]]
        it["failing_check_count"] = FAILING_CHECKS.get(it["number"], 0)


repositories = [
    {"full_name": L, "owner": "lattice-db", "name": "lattice", "unlisted_backlog_issues": 6,
     "milestone": {"title": "v0.9", "due": d(11, 21), "open": 15, "closed": 24, "closed_in_pace_window": 14}},
    {"full_name": A, "owner": "northwind", "name": "api", "unlisted_backlog_issues": 4,
     "milestone": {"title": "November release", "due": d(11, 18), "open": 4, "closed": 14, "closed_in_pace_window": 8}},
    {"full_name": W, "owner": "northwind", "name": "web-app", "unlisted_backlog_issues": 1,
     "milestone": {"title": "Q4 polish", "due": d(12, 12), "open": 3, "closed": 17, "closed_in_pace_window": 2}},
    {"full_name": K, "owner": "papertrail-ui", "name": "kit", "unlisted_backlog_issues": 0,
     "milestone": {"title": "v2.0", "due": d(1, 15, 2027), "open": 9, "closed": 6, "closed_in_pace_window": 2}},
]


# ---- Reference implementation of the rules, used only to check the fixture. ----
def days_since(iso):
    return (TODAY - date.fromisoformat(iso)).days


def classify(item):
    if item["kind"] == "issue":
        stage = "in_progress" if item["linked_open_pull_request"] else "backlog"
        stalled = stage == "in_progress" and days_since(item["last_activity"]) >= SETTINGS["stalled_after_days"]
        failing_long = False
        waiting_on, wait_days = [], None
    else:
        needs_review = (not item["draft"]) and item["review_decision"] == "REVIEW_REQUIRED"
        stage = "needs_review" if needs_review else "open_pull_requests"
        if item["checks"] == "failing":
            waiting_on, since = [item["author"]], item["checks_failing_since"]
        elif item["review_decision"] == "REVIEW_REQUIRED" and not item["draft"]:
            waiting_on, since = item["requested_reviewers"], item["waiting_since"]
        elif item["review_decision"] == "CHANGES_REQUESTED":
            waiting_on, since = [item["author"]], item["waiting_since"]
        else:
            waiting_on, since = [], None
        wait_days = days_since(since) if since else None
        stalled = (wait_days is not None and wait_days >= SETTINGS["stalled_after_days"]) or \
            days_since(item["last_activity"]) >= SETTINGS["stalled_after_days"]
        failing_long = item["checks"] == "failing" and \
            days_since(item["checks_failing_since"]) > SETTINGS["failing_checks_block_after_days"]
    blocked = bool(item["milestone"]) and (stalled or failing_long)
    waiting_on_you = item["kind"] == "pull_request" and VIEWER in waiting_on
    bucket = "blocked" if blocked else ("needs_your_decision" if waiting_on_you else "on_track")
    return {
        "stage": stage,
        "bucket": bucket,
        "waiting_on": waiting_on,
        "wait_days": wait_days,
        "past_review_target": stage == "needs_review" and wait_days is not None and wait_days > SETTINGS["review_target_days"],
        "no_owner": item["kind"] == "issue" and not item["assignees"],
        "ready_to_merge": item["kind"] == "pull_request" and item["review_decision"] == "APPROVED"
        and item["checks"] == "passing" and not item["draft"],
    }


for item in items:
    item["expected"] = classify(item)

stage_names = ["backlog", "in_progress", "needs_review", "open_pull_requests"]
totals = dict.fromkeys(stage_names, 0)
buckets = {"blocked": 0, "needs_your_decision": 0, "on_track": 0}
for repo in repositories:
    mine = [i for i in items if i["repository"] == repo["full_name"]]
    counts = {s: sum(1 for i in mine if i["expected"]["stage"] == s) for s in stage_names}
    counts["backlog"] += repo["unlisted_backlog_issues"]
    m = repo["milestone"]
    pace = m["closed_in_pace_window"] / SETTINGS["pace_window_days"]
    landing = TODAY + timedelta(days=math.ceil(m["open"] / pace))
    difference = (date.fromisoformat(m["due"]) - landing).days
    has_blocked = any(i["expected"]["bucket"] == "blocked" for i in mine)
    if difference < 0:
        m_status = "late"
    elif difference == 0 or (has_blocked and difference < 2):
        m_status = "at_risk"
    else:
        m_status = "on_track"
    status = "behind" if m_status == "late" else ("at_risk" if has_blocked or m_status == "at_risk" else "on_track")
    repo["expected"] = {
        "stage_counts": counts,
        "open_items": sum(counts.values()),
        "status": status,
        "milestone": {
            "percent_done": round(100 * m["closed"] / (m["closed"] + m["open"])),
            "landing": landing.isoformat(),
            "difference_days": difference,
            "status": m_status,
        },
    }
    for s in stage_names:
        totals[s] += counts[s]
    for i in mine:
        buckets[i["expected"]["bucket"]] += 1
    buckets["on_track"] += repo["unlisted_backlog_issues"]

expected = {
    "open_items": sum(totals.values()),
    "stage_counts": totals,
    "buckets": buckets,
    "blocked": sorted(f'{i["repository"]}#{i["number"]}' for i in items if i["expected"]["bucket"] == "blocked"),
    "waiting_on_you": sorted(f'{i["repository"]}#{i["number"]}' for i in items if i["expected"]["bucket"] == "needs_your_decision"),
    "past_review_target": sorted(f'{i["repository"]}#{i["number"]}' for i in items if i["expected"]["past_review_target"]),
    "no_owner": sorted(f'{i["repository"]}#{i["number"]}' for i in items if i["expected"]["no_owner"]),
    "ready_to_merge": sorted(f'{i["repository"]}#{i["number"]}' for i in items if i["expected"]["ready_to_merge"]),
}

# ---- Checks against the figures shown in the mockups. ----
assert expected["open_items"] == 42, expected
assert totals == {"backlog": 23, "in_progress": 6, "needs_review": 4, "open_pull_requests": 9}, totals
assert buckets == {"blocked": 2, "needs_your_decision": 3, "on_track": 37}, buckets
assert expected["blocked"] == [f"{L}#479", f"{A}#1214"], expected["blocked"]
assert expected["waiting_on_you"] == [f"{L}#491", f"{W}#744", f"{K}#101"], expected["waiting_on_you"]
assert expected["past_review_target"] == [f"{L}#479", f"{L}#491"], expected["past_review_target"]
assert len(expected["no_owner"]) == 5, expected["no_owner"]
assert len(expected["ready_to_merge"]) == 3, expected["ready_to_merge"]
by_name = {r["name"]: r["expected"] for r in repositories}
assert [by_name[n]["stage_counts"][s] for n in ("lattice",) for s in stage_names] == [9, 2, 2, 3]
assert [by_name["api"]["stage_counts"][s] for s in stage_names] == [7, 2, 1, 3]
assert [by_name["web-app"]["stage_counts"][s] for s in stage_names] == [4, 1, 0, 2]
assert [by_name["kit"]["stage_counts"][s] for s in stage_names] == [3, 1, 1, 1]
assert [by_name[n]["open_items"] for n in ("lattice", "api", "web-app", "kit")] == [16, 13, 7, 6]
assert [by_name[n]["status"] for n in ("lattice", "api", "web-app", "kit")] == ["behind", "at_risk", "on_track", "on_track"]
assert [by_name[n]["milestone"]["percent_done"] for n in ("lattice", "api", "web-app", "kit")] == [62, 78, 85, 40]
assert [by_name[n]["milestone"]["landing"] for n in ("lattice", "api", "web-app", "kit")] == \
    ["2026-11-26", "2026-11-18", "2026-12-02", "2027-01-13"]
assert [by_name[n]["milestone"]["difference_days"] for n in ("lattice", "api", "web-app", "kit")] == [-5, 0, 10, 2]
waits = {i["number"]: i["expected"]["wait_days"] for i in items if i["kind"] == "pull_request"}
assert (waits[479], waits[491], waits[1210], waits[101], waits[744], waits[1214]) == (6, 4, 2, 1, 2, 2), waits

data = {
    "about": "Invented sample data matching the Dirigo mockups. The 'expected' blocks are what the rules in "
             "docs/04-data-and-rules.md must produce; do not read them as inputs. Eleven backlog issues are not "
             "listed individually and appear only as 'unlisted_backlog_issues' per repository; treat them as "
             "assigned, on-track backlog issues. Each repository's milestone 'open' and 'closed' counts are "
             "authoritative; the milestone field on items covers the listed items only.",
    "today": TODAY.isoformat(),
    "viewer": VIEWER,
    "settings": SETTINGS,
    "repositories": repositories,
    "items": items,
    "expected": expected,
}
out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print("fixture ok:", len(items), "items listed;", expected["stage_counts"], expected["buckets"])
