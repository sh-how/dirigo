# Screens

There are 13 agreed screens: 3 for the first visit, 7 for daily use and 3 empty states. Each has a standalone mockup in `design/screens/` and a screenshot in `design/screenshots/`.

The routes are proposals. The mockups are the source of truth for layout and copy. Terms such as "blocked" and "waiting on you" are defined in `04-data-and-rules.md`.

## Map

| # | Screen | Proposed route | Mockup file |
|---|---|---|---|
| 1 | Landing page | `/` | `01-landing.html` |
| 2 | Connect GitHub | `/connect` | `02-connect-github.html` |
| 3 | Choose repositories | `/setup/repositories` | `03-choose-repositories.html` |
| 4 | Today | `/today` | `04-today.html` |
| 5 | All work | `/work` | `05-all-work.html` |
| 6 | Repositories | `/repositories` | `06-repositories.html` |
| 7 | One repository | `/repositories/:owner/:name` | `07-repository.html` |
| 8 | Reviews | `/reviews` | `08-reviews.html` |
| 9 | Milestones | `/milestones` | `09-milestones.html` |
| 10 | Settings | `/settings` | `10-settings.html` |
| 11 | Today, no repositories | `/today` (state) | `11-today-empty-no-repositories.html` |
| 12 | Today, nothing blocked | `/today` (state) | `12-today-empty-nothing-blocked.html` |
| 13 | All work, columns empty | `/work` (state) | `13-all-work-empty-columns.html` |

## The flow

1. A visitor lands on `/` and presses "Connect GitHub".
2. `/connect` explains access; "Continue with GitHub" starts GitHub sign-in.
3. After GitHub returns, `/setup/repositories` lets them choose repositories; "Open my dashboard" goes to `/today`.
4. A returning signed-in user goes straight to `/today`.
5. A signed-in user watching no repositories sees screen 11.

## App shell (screens 4 to 13)

A left sidebar, 210 px wide, on every signed-in screen:

- Logo and wordmark, linking to the landing page in the mockups. In the product it should link to `/today`.
- Navigation in this order: Today, All work, Repositories, Reviews, Milestones. The current page has a tinted background.
- Reviews shows an amber count badge: the number of items waiting on the user. No badge when it is zero.
- At the bottom: sync status ("Synced 2 minutes ago") and a Settings link.
- On a narrow screen the sidebar stacks above the content.

## 1. Landing page

- **Job:** state the promise and get the visitor to connect GitHub.
- **Primary action:** "Connect GitHub", repeated in the header, hero and closing band. One secondary link: "See a sample dashboard".
- **Sections, in order:** header; hero with headline, one-paragraph explanation and a preview card; "Three questions you ask every morning"; "Three steps from sign-in to your first answer"; "We read. We do not touch." with proof placeholders; closing call to action; footer.
- **Placeholders to fill:** customer logos, a customer quote, company name and year.
- **Note:** "See a sample dashboard" should open the app with the sample data, signed out.

## 2. Connect GitHub

- **Job:** remove the worry about access before the user approves it.
- **Primary action:** "Continue with GitHub".
- **Content:** a three-step progress indicator (Connect, Choose repositories, Today); what Dirigo can read (4 items); what Dirigo cannot do (3 items); a link for GitHub Enterprise or single sign-on users to connect with an access token.
- **Not designed:** the access-token flow, and what happens if the user cancels on GitHub. See open questions.
- **Rule:** the lists on this screen must stay true. If permissions change, change this screen.

## 3. Choose repositories

- **Job:** pick the repositories the user answers for.
- **Primary action:** "Open my dashboard".
- **Content:** headline question; count of repositories the user has been active in over the last 90 days; search; a "Suggested" and "All" switch; one row per repository with a checkbox, name, owner, role (Maintainer or Contributor), last activity and open-item count; a summary panel listing the chosen repositories and the total open items.
- **Behaviour:** the most active repositories are ticked by default (4 in the mockup). The summary updates as boxes change. The button is disabled with zero chosen.
- **Not designed:** a repository the user can see but Dirigo is not yet allowed to read. See open questions.
- **Reached from:** Connect, the "Add repository" buttons, and the no-repositories empty state.

## 4. Today

- **Job:** answer "what is blocked, what needs me, will we ship" in one look. This is the home screen.
- **Headline:** generated. Examples: "Two things are blocking delivery." / "Nothing is blocked. Nothing is waiting on you."
- **Content, in order:**
  1. Date, headline, one supporting sentence with the other two counts.
  2. Three bucket tabs with large counts: Blocked, Needs your decision, On track. Together they account for every open item.
  3. Left column, "Blocked": one card per blocked item with a plain-language problem as its title, the item title and number, the repository, and three facts: what it holds up, who it is waiting on, since when. One or two links to GitHub.
  4. Left column, "Needs your decision": one row per item waiting on the user with its number, what was asked, how long ago, and one link named for the action ("Review", "Revise").
  5. Right column, "Will we ship on time?": one block per repository with status, next milestone, due date, days left, progress bar, percent done and a one-line projection.
- **Behaviour:** the bucket tabs filter the left column. Repository names link to screen 7.
- **States:** screens 11 and 12.

## 5. All work

- **Job:** see and coordinate every open item across every watched repository. This is the overview the product exists for.
- **Headline:** "All work", with a sentence giving totals, blocked count and no-owner count.
- **Content:**
  1. Quick filters with counts: Everything, Blocked, Waiting on me, No owner.
  2. Selects: Person, Label, and Rows (by repository, by person, by milestone, no rows).
  3. A grid. Columns are the four stages with a count and a short description each. Rows are repositories by default, each with status icon, name, open count and an "Open repository" link to screen 7.
  4. Cards in each cell: title, number, owner or "no owner", and age or last update. At most 3 cards per cell, then an "N more" link.
- **Card variants:** plain; blocked (red border, red label, what it holds up); waiting on you (amber border and label); ready to merge (green text); no owner (bold "no owner").
- **Selected card:** shows one button, "Open on GitHub". The mockup shows one card selected.
- **Behaviour:** filters combine. "N more" expands the cell or opens screen 7 filtered to that stage.
- **States:** screen 13. A stage with no items in a row shows short muted text ("No open issues", "Nothing in progress", "Nothing waiting", "No open pull requests").

## 6. Repositories

- **Job:** compare repositories side by side.
- **Primary action:** "Add repository", which goes to screen 3.
- **Content:** one table row per repository, worst first: status icon, name, owner, a one-line reason; the count in each of the four stages; next milestone with due date, progress bar and status; a link to screen 7. A totals row at the bottom.
- **Emphasis:** the stage where a repository is stuck has its count on a filled red background. Zero counts are muted.

## 7. One repository

- **Job:** work through a single repository's board.
- **Content:** a back link; repository name with a status pill; a one-sentence reason; a milestone card (name, due date, days left, progress, projection); filters (Everything, Blocked, Waiting on me); a four-column board with the same card variants as screen 5, each card showing the title, then the item number ("Issue 482") with its labels as neutral tags, then one line of state (age or last update, and owner, with a missing owner in bold); "Show N more" at the bottom of a long column.
- **Not designed:** the header for a repository with no milestone.

## 8. Reviews

- **Job:** show who each review is waiting on and for how long.
- **Headline:** generated from the worst wait, for example "One review has been stuck for 6 days."
- **Content:**
  1. A legend for the wait bar: the tick marks the review target; a full bar is one week; green within target, red past it.
  2. "Waiting on you": every pull request flagged as waiting on the user. Rows with title, repository, number, author, size, check status; what is asked of the user; the wait bar and days; one link named for the action.
  3. "Waiting on someone else": pull requests in the "Needs review" stage that are not waiting on the user. The same rows with the person's name. A blocked row carries a red tag naming the milestone it holds up.
  4. "Who is carrying the reviews": per person, how many reviews are requested from them and the oldest wait.
- **Sort:** longest wait first within each section, except that the mockup lists "Waiting on you" first as a section.

## 9. Milestones

- **Job:** show whether each milestone will land before its due date.
- **Headline:** generated, for example "One milestone will be late. One is at risk."
- **Content:** a legend; a shared time axis starting today with month marks; one row per milestone, worst first, with repository and milestone name, due date and projected landing date, the difference in days ("5 days late", "7 days early"), a track showing a bar from today to the projected landing, a tick at the due date and a dot at the landing date, and a note with percent done, items left and what is in the way.
- **Scale:** the axis runs from today to a little after the latest due date.

## 10. Settings

- **Job:** set the rules, manage watched repositories, choose light or dark, manage the GitHub connection.
- **Sections:**
  1. "Your rules": review is late after N days (default 2); work is stalled after N days without activity (default 5); what counts as in progress (four options); pace window for projections (14, 7 or 30 days). One "Save rules" button.
  2. "Repositories you watch": a list with "Stop watching" per repository and an "Add repository" link to screen 3.
  3. "Appearance" (added at the product owner's request): System, Light or Dark. System follows the device. The choice is kept in the browser, not on the account, and applies before the page draws.
  4. "GitHub connection": who is connected, a reminder that access is read-only, and "Disconnect GitHub".
- **Note:** these are the only changes a user makes inside Dirigo. None of them writes to GitHub.
- **Not designed:** confirmation for "Disconnect GitHub" and for "Stop watching".

## 11. Today, no repositories

- **When:** signed in, watching zero repositories.
- **Content:** a sentence, one button ("Choose repositories"), three dashed outlines previewing the three buckets, and a link to check access on GitHub.

## 12. Today, nothing blocked

- **When:** there are open items, but none is blocked and none waits on the user.
- **Content:** "Nothing is blocked. Nothing is waiting on you."; the three buckets with zeros muted and On track emphasised in green; the milestone list in a two-column grid, all on track; a link to All work.

## 13. All work, columns empty

- **When:** one or more stages have no items in any repository.
- **Content:** a panel stating which columns are empty and that new items appear when opened on GitHub; quick filters with zero counts disabled; the grid with muted column headers at 0 and short muted text in each empty cell.
- **Note:** the mockup keeps two ready-to-merge pull requests so empty and filled cells are seen together.

## States not yet designed

Every signed-in screen also needs these. Follow the existing visual language and keep them plain.

- Loading: first sync after choosing repositories, and later refreshes.
- Error: GitHub unreachable, access revoked, rate limit reached, a repository removed or renamed.
- Reviews and Milestones with nothing to show.
- A repository with no milestones.
- Phone-width layouts.
