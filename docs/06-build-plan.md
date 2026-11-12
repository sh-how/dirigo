# Build plan

Six phases, in order. Each ends with something that can be shown. Do not start a phase until the one before it meets its acceptance criteria.

## Phase 1: Interface on sample data

Build every screen as real components reading from `design/sample-data.json`. No GitHub connection.

**Work**

- Project scaffold, linting, tests, continuous integration.
- Design tokens from `design/tokens.css`; the Instrument Sans font.
- The component set listed in `docs/03-design-system.md`.
- The rules engine as a pure module implementing `docs/04-data-and-rules.md`.
- All 13 screens, with routing between them as in the mockups.

**Accepted when**

- Each screen matches its screenshot at 1440 px wide.
- Each screen reflows to one column at 390 px with no horizontal page scroll.
- The rules engine reproduces every figure in the "Sample data check" table from the fixture.
- Changing the fixture changes the screens and the headlines consistently. For example, removing the two blocked items produces screen 12.
- Keyboard navigation and contrast pass on every screen.

## Phase 2: Sign-in and onboarding

**Work**

- Register the GitHub App with read-only permissions.
- Sign-in, sessions, sign-out, and encrypted token storage.
- Connect screen wired to GitHub sign-in.
- Choose repositories screen wired to the user's real repositories, with search and the suggested list.
- Watches stored per user.

**Accepted when**

- A new user can go from the landing page to an empty Today in under a minute.
- The permissions GitHub shows on its approval page match the Connect screen exactly.
- A user with no watched repositories sees screen 11.
- Cancelling on GitHub returns the user to Connect with a plain explanation.

## Phase 3: Sync

**Work**

- Database schema for repositories, items, pull request details, milestones and item events.
- First-sync job per watched repository.
- Webhook endpoint with signature verification and a processing job.
- Periodic reconciliation.
- Sync status per repository.

**Accepted when**

- After choosing a repository, its open issues and pull requests are stored and match GitHub.
- A change made on GitHub appears in the database within a few minutes, with webhooks on and with webhooks off.
- Rate-limit responses are handled without losing data.
- No source code or file content is stored.

## Phase 4: Screens on real data

**Work**

- The app's API endpoints, each returning classified data from the rules engine.
- Today, All work, Repositories, One repository, Reviews and Milestones wired to the API.
- Filters and row grouping on All work.
- Access check on every repository read.

**Accepted when**

- For a real account, the four stage counts on Repositories add up to the total on All work, and the three bucket counts on Today add up to the same total.
- An item appears with the same status on every screen that shows it.
- Every action link opens the right page on GitHub.
- A second test user cannot retrieve data for a private repository they cannot access.

## Phase 5: Settings and remaining states

**Work**

- Settings: rules, watched repositories, disconnect.
- Empty states 11 to 13, plus empty Reviews and Milestones.
- Loading and error states on every screen.
- A repository with no milestone.

**Accepted when**

- Changing the review target or stalled threshold changes what is flagged on the next load.
- Stopping a watch removes the repository from every screen.
- Disconnecting deletes the user's tokens, watches and settings.
- Losing GitHub access produces a clear message with a way to reconnect.

## Phase 6: Hardening and launch

**Work**

- The security checklist in `docs/05-architecture.md`.
- End-to-end tests for the main flow.
- Performance: Today loads quickly for a user watching 20 repositories.
- Monitoring, error reporting and backups.
- Landing page placeholders replaced with real content from the product owner.
- Privacy policy and terms pages, supplied by the product owner.

**Accepted when**

- The security checklist is complete and reviewed.
- The main flow passes automated tests in continuous integration.
- No bracketed placeholder remains on a public page.

## Not in this plan

See "Out of scope for the first version" in `docs/01-product-brief.md`. In particular: no write actions, no other hosts, no teams or billing, no notifications.
