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
| 11 | How are the label and project-column options for "in progress" configured? | They are options in Settings with no configuration screen | Ship the first two options only; remove the other two until they are designed |
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
