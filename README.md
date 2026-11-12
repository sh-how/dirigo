# Dirigo

Dirigo reads the GitHub repositories you contribute to and tells you, on one screen, what is blocked, what needs your decision, and whether each milestone will ship on time. It is read-only: every action button opens GitHub.

The product specification lives in [`docs/`](docs/00-handoff.md) and the agreed design in [`design/`](design/). The rules for working in this repository are in [`AGENTS.md`](AGENTS.md).

## Try it

```bash
npm install
npm run dev
```

Open <http://localhost:5180> and choose **See a sample dashboard**. Without GitHub settings the server runs in sample mode: every screen works against [`design/sample-data.json`](design/sample-data.json), clearly marked as invented data. Changes you make in sample mode (rules, watched repositories) are kept in your browser.

## How it is built

| Part | Where | Notes |
|---|---|---|
| Rules engine | [`src/shared/rules.ts`](src/shared/rules.ts) | Pure TypeScript, no I/O. Stages, buckets, flags, repository status and milestone projection from [`docs/04-data-and-rules.md`](docs/04-data-and-rules.md) |
| Screen view models | [`src/shared/views.ts`](src/shared/views.ts) | Every generated sentence and card line, in one place so all screens agree |
| API server | [`src/server/app.ts`](src/server/app.ts) | Hono on Node. Sample API under `/api/sample/*`, live API under `/api/*`, GitHub sign-in under `/auth/*`, webhooks at `/api/webhooks/github` |
| GitHub access | [`src/server/github/`](src/server/github/) | GitHub App user sign-in (PKCE), installation tokens, GraphQL sync queries, mapping to the rules engine |
| Storage | [`src/server/db/schema.ts`](src/server/db/schema.ts), [`src/server/store.ts`](src/server/store.ts) | Postgres. Metadata only; tokens encrypted with AES-256-GCM |
| Jobs | [`src/server/jobs.ts`](src/server/jobs.ts) | pg-boss: first sync, webhook-triggered sync, reconciliation every 15 minutes, cleanup of unwatched repositories |
| Client | [`src/client/`](src/client/) | React, Vite, TanStack Query, components built from [`design/tokens.css`](design/tokens.css) |

## Checks

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

`npm test` includes the fixture check: the rules engine must reproduce every figure in the "Sample data check" table. `node tools/screenshots.mjs` captures every sample screen at 1440 px and 390 px into `test-results/screens` for comparison with [`design/screenshots/`](design/screenshots/), and reports any horizontal page scroll.

## Connecting real GitHub data

Live mode needs Postgres, a GitHub App and an encryption key. Copy [`.env.example`](.env.example) to `.env`, fill it in, and start with `node --env-file=.env dist/server/server/main.js` after `npm run build`.

### Quick start on your own machine

```bash
docker compose up -d
```

```bash
node tools/register-github-app.mjs
```

Open <http://localhost:3999>, press **Continue to GitHub**, check the read-only permissions and create the app. The helper writes its credentials and a fresh encryption key to `.env`, which is git-ignored. Install the app from the link it shows, then run `npm run dev` and sign in at <http://localhost:5180/connect>. GitHub does not accept a `localhost` webhook, so a local app has none; the 15-minute reconciliation keeps data current.

### Register the GitHub App by hand

Create one app per environment (GitHub → Settings → Developer settings → GitHub Apps → New GitHub App).

- **Callback URL:** `<APP_URL>/auth/github/callback`
- **Expire user authorization tokens:** on (Dirigo refreshes them)
- **Webhook URL:** `<APP_URL>/api/webhooks/github`, with a secret
- **Repository permissions, all read-only:** Metadata, Issues, Pull requests, Checks, Commit statuses. Nothing else, and no write access. The Connect screen promises exactly this; if you change the permissions, change [`src/client/pages/Connect.tsx`](src/client/pages/Connect.tsx).
- **Subscribe to events:** Issues, Pull request, Pull request review, Pull request review comment, Pull request review thread, Check run, Check suite, Status, Milestone, Label

Then put the app id, slug, client id and secret, private key and webhook secret in `.env`. Users install the app on their account or organisation from the Choose repositories screen.

### Run it

```bash
npm run build
```

```bash
node --env-file=.env dist/server/server/main.js
```

The server applies database migrations on start and runs the job workers in the same process. To run workers separately, start the web process with `RUN_WORKERS=false` and run `npm run worker`.

A [`Dockerfile`](Dockerfile) builds a single image that serves the client and the API.

## Status against the build plan

| Phase | State |
|---|---|
| 1. Interface on sample data | Done. All 13 screens, rules engine checked against the fixture, compared with the screenshots at 1440 px, one column at 390 px |
| 2. Sign-in and onboarding | Built: GitHub App sign-in with PKCE, sessions, encrypted tokens, Choose repositories on real data. Needs a registered GitHub App to verify end to end |
| 3. Sync | Built: schema, first sync, webhooks with signature checks, reconciliation, rate-limit handling. The GraphQL queries were validated against GitHub's live schema. Needs a database and app to verify end to end |
| 4. Screens on real data | Built: every endpoint serves classified data and checks repository access on GitHub before serving it |
| 5. Settings and remaining states | Built: rules, watches, disconnect with confirmation, empty, loading and error states |
| 6. Hardening and launch | Partly: security headers, CSRF protection, access log, CI with end-to-end tests. Monitoring, backups, real landing content, privacy policy and terms are still owed |

Decisions made behind proposed defaults, and new questions found while building, are listed in [`docs/07-open-questions.md`](docs/07-open-questions.md).
