# Data model and rules

This document defines the terms the screens use. The stage rules follow what was agreed with the product owner. The rules for "blocked", "at risk" and milestone projection are proposals that reproduce the mockups; they are marked **Proposed** and listed in `07-open-questions.md` for confirmation.

All thresholds are per-user settings with the defaults shown.

## Entities

| Entity | Key fields |
|---|---|
| User | GitHub user id, login, name, settings |
| Repository | GitHub id, owner, name, visibility |
| Watch | User, repository. A user's dashboard is built from their watches |
| Item | Repository, number, kind (issue or pull request), title, state, author, assignees, labels, milestone, created, updated, URL |
| Pull request detail | Draft flag, review decision, requested reviewers, reviews with time and state, check rollup state with the time it first failed, linked issues, files changed |
| Milestone | Repository, title, due date, open count, closed count |
| Item event | Item, kind (opened, closed, assigned, review requested, reviewed, checks changed, commented), time, actor. Needed for wait times and pace |

Only open items appear on screens. Closed items are kept for milestone progress and pace.

## Stages

Every open item is in exactly one stage. The four stage counts always add up to the total open count.

| Stage | Kind | Rule |
|---|---|---|
| Backlog | Issue | Open, and not in progress |
| In progress | Issue | Open, and matches the user's "in progress" rule |
| Needs review | Pull request | Open, not a draft, review requested or required, no changes requested, not yet approved |
| Open pull requests | Pull request | Every other open pull request: drafts, changes requested, approved |

The "in progress" rule is a setting with four options:

1. **Default:** an open pull request is linked to the issue. Being assigned means someone owns it, not that it has started, so an assigned issue with no pull request stays in the backlog.
2. The issue is assigned to someone. With this option every backlog issue has no owner.
3. The issue has a label the user chooses.
4. The issue sits in a chosen column of a GitHub project.

Options 3 and 4 are shown in Settings but their configuration screens are not designed. The default is a proposal; see `07-open-questions.md`.

An issue and the pull request that closes it are separate items and both are counted.

Pull requests in "Open pull requests" carry a sub-state shown on the card: draft, changes requested, or ready to merge. **Ready to merge** means approved, checks passing and not a draft.

## Who an item is waiting on

| Situation | Waiting on | Waiting since |
|---|---|---|
| Review requested, none given | The requested reviewers | The time of the review request |
| Changes requested | The author | The time of that review |
| Checks failing | The author | The time checks first failed on the current head |
| In progress issue | The assignees (used for the stalled flag only) | The last activity |
| Backlog issue with no assignee | Nobody ("no owner") | Created time |

## Flags

Flags are independent of stage.

| Flag | Rule | Default |
|---|---|---|
| No owner | An open issue with no assignee | |
| Past target | In "Needs review" and waiting longer than the review target | 2 days |
| Stalled | An in-progress issue or a pull request that has been waiting, or without any activity, for at least the stalled threshold. Backlog issues are never stalled | 5 days |
| Waiting on you | A pull request is waiting on the signed-in user: their review was requested, or it is their own pull request with changes requested or failing checks. Issues assigned to the user are their ongoing work and do not count | |
| Blocked | **Proposed.** The item belongs to a milestone with a due date, and either it is stalled or its checks have been failing for more than one day | |

## The three buckets on Today

Every open item falls into exactly one bucket, tested in this order:

1. **Blocked:** the item is blocked.
2. **Needs your decision:** the item is waiting on you and is not blocked.
3. **On track:** everything else.

The three counts add up to the total open count.

A blocked item's card states:

- **Problem headline:** "A review has stalled for N days" or "Checks are failing on a release pull request".
- **Holds up:** the milestone title and due date.
- **Waiting on:** the person and their role (reviewer, author).
- **Since:** the date the wait began.

## Repository status

**Proposed.** Tested in order:

| Status | Rule | Shown as |
|---|---|---|
| Behind | Its next milestone is projected to land after its due date | Red, "Behind" or "N days late" |
| At risk | It has a blocked item, or its next milestone has no days to spare | Red, "At risk" |
| On track | Otherwise | Green, "On track" |

The one-line reason beside a repository is the problem headline of its most severe blocked item, or "Nothing is stuck".

The stage that holds a repository's blocked item is the one highlighted in red in the Repositories table.

## Milestone projection

**Proposed.** For each repository's next open milestone with a due date:

- **Percent done** = closed items ÷ (closed + open items) in the milestone.
- **Pace** = items closed in the milestone during the pace window ÷ days in the window. The window defaults to 14 days.
- **Landing date** = today + (open items ÷ pace), rounded up to a whole day.
- **Difference** = due date − landing date, shown as "N days early" or "N days late".
- **Late** when the landing date is after the due date.
- **At risk** when the difference is zero, or when the milestone contains a blocked item and the difference is under two days.
- **On track** otherwise.
- If the pace is zero, there is no landing date. Show "No progress in the last N days" and treat the milestone as late.

"Next milestone" is the open milestone with the earliest due date. Milestones without a due date are not projected.

## Review load

For the "Who is carrying the reviews" panel: for each person, the number of pull requests whose review is requested from them and the longest wait among those. Changes requested and failing checks do not count here.

## Sorting

- Blocked items: earliest milestone due date first, then longest wait.
- Waiting on you: longest wait first.
- Repositories: Behind, then At risk, then On track; within each, earliest due date.
- Cards in a cell: blocked, then waiting on you, then no owner, then most recently updated.
- Milestones: late, then at risk, then on track; within each, earliest due date.

## Sample data check

`design/sample-data.json` holds the data in the mockups. The rules engine is correct when, run on that fixture with "today" set to 11 November 2026 and the signed-in user set to `you`, it produces:

| Measure | Expected |
|---|---|
| Open items | 42 |
| Backlog / In progress / Needs review / Open pull requests | 23 / 6 / 4 / 9 |
| Blocked / Needs your decision / On track | 2 / 3 / 37 |
| Blocked items | lattice 479, api 1214 |
| Waiting on you | lattice 491, web-app 744, kit 101 |
| Reviews past the 2-day target | 2 (lattice 479 and 491) |
| No owner | 5 (lattice 482 and 476, api 1207, web-app 751, kit 94). The 11 unlisted backlog issues count as assigned |
| lattice | 9 / 2 / 2 / 3, Behind, 5 days late |
| api | 7 / 2 / 1 / 3, At risk, lands on its due date |
| web-app | 4 / 1 / 0 / 2, On track, 10 days early |
| kit | 3 / 1 / 1 / 1, On track, 2 days early |

`tools/build_fixture.py` contains a short Python reference implementation of these rules and asserts every row of this table. Use it to settle any ambiguity in the wording above.

The fixture lists the 31 items drawn in the mockups in full. The other 11 backlog issues are given only as a count per repository, so stage counts must add those in.

## What to read from GitHub

Verify field names against GitHub's current API documentation before use.

| Need | Source |
|---|---|
| Repositories the user can access and has been active in | The user's repository and contribution lists |
| Open issues with assignees, labels, milestone, timestamps | Issues |
| Open pull requests with draft flag, review decision, requested reviewers, reviews | Pull requests |
| Linked issues for a pull request | Closing references on the pull request |
| Check results | The status check rollup on the pull request's head commit |
| Milestones with due dates and counts | Milestones |
| Times of review requests, reviews and check changes | Timeline events, or webhook deliveries stored as item events |
| Closed items in each milestone over the pace window | Issues and pull requests closed since a date |

GitHub's GraphQL API can return most of this per repository in one request and is the better fit for the first load.
