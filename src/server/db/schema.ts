// Database migrations, applied in order. Each runs once inside a transaction.
// Only metadata is stored: titles, states, labels, people, checks, milestones, timestamps.

export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_initial',
    sql: `
CREATE TABLE users (
  id                 bigserial PRIMARY KEY,
  github_id          bigint UNIQUE NOT NULL,
  login              text NOT NULL,
  name               text,
  access_token       text NOT NULL,       -- encrypted
  access_expires_at  timestamptz,
  refresh_token      text,                -- encrypted
  refresh_expires_at timestamptz,
  settings           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          text PRIMARY KEY,           -- sha256 of the cookie value
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE repositories (
  id               bigint PRIMARY KEY,    -- GitHub database id
  owner            text NOT NULL,
  name             text NOT NULL,
  full_name        text UNIQUE NOT NULL,
  private          boolean NOT NULL,
  url              text NOT NULL,
  installation_id  bigint,
  last_synced_at   timestamptz,
  sync_error       text,
  sync_error_at    timestamptz,
  unwatched_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE watches (
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id  bigint NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, repository_id)
);

CREATE TABLE access_checks (
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id  bigint NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  ok             boolean NOT NULL,
  checked_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, repository_id)
);

-- One row per open issue or pull request. "data" holds the normalised item the rules read.
CREATE TABLE items (
  repository_id  bigint NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  number         integer NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('issue', 'pull_request')),
  data           jsonb NOT NULL,
  updated_at     timestamptz NOT NULL,
  PRIMARY KEY (repository_id, number)
);

CREATE TABLE milestones (
  repository_id  bigint NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  number         integer NOT NULL,
  title          text NOT NULL,
  due_on         date,
  open_count     integer NOT NULL,
  closed_count   integer NOT NULL,
  url            text NOT NULL,
  PRIMARY KEY (repository_id, number)
);

-- Items closed in a milestone, kept for the pace calculation.
CREATE TABLE milestone_closures (
  repository_id     bigint NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  item_number       integer NOT NULL,
  milestone_number  integer NOT NULL,
  closed_at         timestamptz NOT NULL,
  PRIMARY KEY (repository_id, item_number)
);

-- Item events: when a wait began. Derived from GitHub timelines and webhook deliveries.
CREATE TABLE item_events (
  repository_id  bigint NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  item_number    integer NOT NULL,
  kind           text NOT NULL,
  actor          text,
  occurred_at    timestamptz NOT NULL,
  PRIMARY KEY (repository_id, item_number, kind, occurred_at)
);

CREATE TABLE webhook_deliveries (
  id            text PRIMARY KEY,         -- X-GitHub-Delivery
  event         text NOT NULL,
  action        text,
  repository    text,
  installation  bigint,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

-- Log of access to private repository data. Never stores content.
CREATE TABLE access_log (
  id             bigserial PRIMARY KEY,
  user_id        bigint NOT NULL,
  repository_id  bigint NOT NULL,
  endpoint       text NOT NULL,
  at             timestamptz NOT NULL DEFAULT now()
);
`,
  },
];
