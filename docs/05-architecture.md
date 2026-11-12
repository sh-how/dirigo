# Architecture

Dirigo is a hosted web application. This document recommends a stack and sets the constraints that are not negotiable. The stack is a recommendation; the constraints are requirements.

Details about GitHub's API (permission names, events, token lifetimes, rate limits) are written from general knowledge. Check each against GitHub's current documentation before relying on it.

## Requirements

1. Read-only access to GitHub. No write permission is requested.
2. No source code is read or stored.
3. A user sees data only for repositories they can access on GitHub.
4. Access tokens are encrypted at rest and never sent to the browser.
5. Data on screen is at most a few minutes old.
6. A user can disconnect, and their tokens and watch list are deleted.

## Recommended stack

| Part | Recommendation | Why |
|---|---|---|
| Language | TypeScript throughout | One language for the rules engine, API and interface |
| Frontend | React with Vite | Matches the earlier recommendation; the interface is a set of data-driven screens |
| Data fetching | TanStack Query | Caching and background refresh per screen |
| API server | Node with a small framework such as Hono or Fastify | Holds tokens, serves the app's own API, receives webhooks |
| Database | Postgres | Relational data, row-level scoping per user |
| Background jobs | A Postgres-backed queue such as pg-boss | First sync, webhook processing and periodic reconciliation without another service |
| Rules engine | A pure TypeScript module with no I/O | The rules in `04-data-and-rules.md`, unit-tested against the fixture |
| Tests | Vitest for units, Playwright for screens | |
| Hosting | Any platform that runs a Node service, a worker and Postgres | |

A full-stack React framework is an acceptable alternative if you prefer one deployable for the landing page and the app. Keep the rules engine a separate pure module either way.

## GitHub access

Use a **GitHub App**, not a classic OAuth app.

- A classic OAuth app has no read-only scope for private repositories: its `repo` scope grants write access. That would break the promise on the Connect screen.
- A GitHub App can request read-only permissions per resource.

**Permissions to request, all read-only:** repository metadata, issues, pull requests, checks, commit statuses. Milestones are covered by issues.

**Sign-in:** the GitHub App's user authorization flow identifies the user and returns a user token. Use it to learn who the user is and which repositories they can access.

**Reading repository data:** use installation tokens. They are short-lived and created on demand, so store the installation id, not the token.

**A constraint to design for:** a GitHub App only sees repositories where it is installed. A user can install it on their own account. For an organisation's repositories, an organisation owner may have to approve the installation. Until then Dirigo cannot read those repositories, even though the user can. The "Choose repositories" screen needs a state for this, which is not yet designed. See open questions. Public repositories can be read without installation.

## Keeping data current

1. **First sync:** when a user starts watching a repository, a job loads its open issues, open pull requests, milestones and recently closed items.
2. **Webhooks:** the GitHub App subscribes to events for issues, pull requests, pull request reviews, check runs or suites, commit statuses, milestones, and installation changes. Each delivery is verified by its signature, stored, and applied by a job.
3. **Reconciliation:** a periodic job re-reads each watched repository to repair missed events. Start at every 15 minutes and tune.
4. **Sync status:** store the last successful sync per repository and show it in the sidebar.

Respect GitHub's rate limits: batch with GraphQL, back off on limit responses, and never sync a repository nobody watches.

## Data ownership and privacy

- Repository data is shared storage: two users watching the same repository read the same rows.
- Before serving any repository data, confirm that the signed-in user can access that repository on GitHub. Cache the answer briefly and re-check on a schedule and when access errors occur.
- When a user loses access to a repository, remove their watch.
- When the last watch on a repository is removed, stop syncing it and delete its data after a grace period.
- When a user disconnects, delete their tokens, watches and settings.

## The app's own API

A small JSON API consumed only by the frontend. Suggested shape:

| Endpoint | Returns |
|---|---|
| `GET /api/me` | The user, settings, sync status |
| `GET /api/today` | Buckets with counts, blocked items, items waiting on the user, repository milestone blocks |
| `GET /api/work` | Items grouped by row and stage, with filters as query parameters |
| `GET /api/repositories` | Table rows with stage counts, status and milestone |
| `GET /api/repositories/:owner/:name` | One repository's header and board |
| `GET /api/reviews` | Review rows in three groups and the per-person load |
| `GET /api/milestones` | Milestone rows with projection |
| `GET /api/available-repositories` | Repositories the user can add, with role, activity and open count |
| `PUT /api/watches` | Replace the watch list |
| `PUT /api/settings` | Save the user's rules |
| `DELETE /api/connection` | Disconnect and delete the user's data |
| `POST /api/webhooks/github` | Receives GitHub deliveries |

Classification happens on the server with the rules engine, so every screen agrees. Headline sentences may be generated on either side, but from one shared function.

## Security checklist

- Encrypt user tokens at rest with a key held outside the database.
- Sessions in secure, HTTP-only, same-site cookies.
- Verify the signature of every webhook delivery and reject the rest.
- Protect state-changing endpoints against cross-site request forgery.
- Escape all GitHub-supplied text on output. Titles and labels are untrusted input.
- Log access to private repository data without logging its content.
- Keep the GitHub App's private key and webhook secret in a secrets manager.

## Environments

- **Local:** the app runs against `design/sample-data.json` with no GitHub connection. This is also what "See a sample dashboard" on the landing page shows.
- **Development:** a separate GitHub App registration pointed at a development URL.
- **Production:** its own GitHub App registration, database and secrets.
