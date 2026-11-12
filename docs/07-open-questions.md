# Open questions

These decisions belong to the product owner. Each has a proposed default so work is not blocked. Ask before making a default permanent.

## Needs an answer before Phase 2

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| 1 | What happens for an organisation's repository that the user can see but Dirigo is not installed on? | A read-only GitHub App must be installed by an organisation owner. Without this, many users will find their main repositories missing | Show the repository in "Choose repositories" as unavailable, with one line explaining that an owner must approve Dirigo and a link to request it |
| 2 | Is sign-in by access token (for GitHub Enterprise and single sign-on) in the first version? | The Connect screen links to it, but it is not designed | Leave it out; hide the link until it is designed |
| 3 | Has the name "Dirigo" been checked for trademarks and domains? | The name appears everywhere, including the GitHub App registration | Proceed, but keep the name in one configuration value |

## Needs an answer before Phase 4

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| 4 | Is the definition of "blocked" right? | It decides the headline on Today. Proposed: in a milestone with a due date, and stalled or failing checks for over a day | As proposed in `04-data-and-rules.md` |
| 5 | Should an item outside any milestone ever be blocked? | Many repositories do not use milestones; with the proposed rule they would never show a blocked item | No; show it as past target or stalled only |
| 6 | Is the milestone projection right? | "Will we ship on time" depends on it. Proposed: remaining items divided by the closing pace of the last 14 days | As proposed |
| 7 | What should "Will we ship on time?" show for a repository with no milestones or no due dates? | The column would be empty for such repositories | Show the repository with "No milestone with a due date" and no bar |
| 8 | Does "stalled" apply to backlog issues? | With the proposal it does not, so an old unassigned bug is only "no owner" | No |
| 9 | Which pull requests count as "Needs review" when nobody was explicitly asked? | Some teams never request reviewers | Count a non-draft pull request with no review yet as needing review, waiting on "any reviewer" |
| 10 | Is "a pull request is linked to it" the right default for "in progress"? | It matches the board in the mockups, where assigned issues can still sit in the backlog. Teams that never link pull requests to issues would see every issue in the backlog | Keep it as the default and offer "it is assigned to someone" as the second option |

## Needs an answer before Phase 5

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| 11 | How are the label and project-column options for "in progress" configured? | They are options in Settings with no configuration screen | Ship the first two options only; remove the other two until they are designed. **Built this way:** the rules engine supports all four; Settings offers the first two (`IN_PROGRESS_OPTIONS` in `src/shared/api.ts`) |
| 12 | How often should Dirigo check GitHub, and what should the empty state promise? | Screen 13 says "every few minutes"; screen 11 says the page fills "in about a minute". Both were guesses | Reconcile every 15 minutes with webhooks in between; change the copy to match what is built |
| 13 | Are confirmations needed for "Stop watching" and "Disconnect GitHub"? | Both remove data | Confirm disconnect; do not confirm stop watching |

## Needs an answer before launch

| # | Question | Proposed default |
|---|---|---|
| 14 | Landing page content: customer logos, a quote, company name | Remove the proof section until real content exists |
| 15 | Pricing and plans | None in the first version; free during a trial period |
| 16 | Privacy policy, terms, and where data is hosted | Required before any public sign-up |
| 17 | Phone layouts | Review after Phase 1 using the built screens |
| 18 | Should "See a sample dashboard" be public? | Yes, using the fixture, clearly marked as sample data |

## Found while building

Each of these is built behind the default shown and is easy to change. Please confirm or correct.

| # | Question | What was built |
|---|---|---|
| 19 | The Today mockup lists the lattice blocked item before the api one, but the sorting rule says "earliest milestone due date first", which puts api (due 18 November) first. Which is right? | The documented rule: api first. Change `compareBlocked` in `src/shared/rules.ts` to sort by repository severity if the mockup order is wanted |
| 20 | Where does sign-out live? The build plan asks for it, but no screen shows it | A "Sign out" button beside "Disconnect GitHub" in Settings |
| 21 | How does a user install the GitHub App on their account or organisation? Without an installation Dirigo can read only public repositories | Choose repositories shows one line with an install link when the user has no installation, and "Ask an owner to approve Dirigo" on private repositories it cannot read (open question 1 default) |
| 22 | Should the sample dashboard keep the visitor's changes? | Yes, in their browser only. Settings in sample mode shows "Reset the sample" and "Connect GitHub" instead of the GitHub connection |
| 23 | The mockups show "Synced 2 minutes ago" for the sample. The sample is never synced | The sample sidebar says "Sample data / Not connected to GitHub", and a banner marks every sample screen as invented data (open question 18) |
| 24 | Which time zone do dates use? | UTC everywhere, so a dataset always reads the same. Per-user time zones would need a setting |
| 25 | What does "N more" show for the eleven backlog issues the fixture counts but does not list? | The expanded cell says they are counted but not listed in the sample data. Live data has no unlisted items |
| 26 | The landing page, Settings and Connect copy that the mockups wrote as guesses ("in about a minute", "checks every few minutes") | Kept as written. Reconciliation runs every 15 minutes, with webhooks in between (open question 12) |
| 27 | Which repositories are "suggested" and which are ticked by default? | Suggested: up to six readable repositories pushed to in the last 90 days, most recent first. Ticked: the top four, or the current watch list when there is one |
| 28 | The fixture had no file counts or failing-check counts, which Reviews and Today show | Added `files_changed` and `failing_check_count` to `tools/build_fixture.py`; the rules do not use them |
| 29 | Repository "last active" on Choose repositories | Uses the repository's last push, not the user's own last activity, which GitHub does not expose cheaply |
| 30 | Should people be able to choose light or dark themselves? | Yes, decided by the product owner: Appearance in Settings offers System, Light and Dark. Proposed: the choice belongs to the browser, not the account, so a phone and a laptop can differ |
