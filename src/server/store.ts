// Database access for users, sessions, watches and repository data.

import type { Db } from './db/pool.js';
import { transaction } from './db/pool.js';
import { decrypt, encrypt, hashToken, randomToken } from './crypto.js';
import type { Dataset, Item, Milestone, Repository, Settings } from '../shared/types.js';
import { DEFAULT_SETTINGS } from '../shared/types.js';
import type { GitHubApp, GitHubUser, UserTokens } from './github/client.js';
import { AccessRevoked } from './github/client.js';

export const SESSION_DAYS = 30;

export interface UserRow {
  id: string;
  github_id: string;
  login: string;
  name: string | null;
  access_token: string;
  access_expires_at: Date | null;
  refresh_token: string | null;
  refresh_expires_at: Date | null;
  settings: Partial<Settings>;
}

export interface RepositoryRow {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  private: boolean;
  url: string;
  installation_id: string | null;
  last_synced_at: Date | null;
  sync_error: string | null;
}

export class Store {
  constructor(private readonly db: Db, private readonly key: Buffer) {}

  // ---- Users and sessions -------------------------------------------------------------

  async upsertUser(gh: GitHubUser, t: UserTokens): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO users (github_id, login, name, access_token, access_expires_at, refresh_token, refresh_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (github_id) DO UPDATE SET login=$2, name=$3, access_token=$4, access_expires_at=$5, refresh_token=$6, refresh_expires_at=$7
       RETURNING id`,
      [gh.id, gh.login, gh.name, encrypt(t.accessToken, this.key), t.accessExpiresAt,
        t.refreshToken ? encrypt(t.refreshToken, this.key) : null, t.refreshExpiresAt],
    );
    return rows[0].id;
  }

  async createSession(userId: string): Promise<string> {
    const token = randomToken();
    await this.db.query(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
      [hashToken(token), userId]);
    return token;
  }

  async userForSession(token: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > now()`, [hashToken(token)]);
    return rows[0] ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE id = $1', [hashToken(token)]);
  }

  /** A valid access token for the user, refreshed when it has expired. */
  async userToken(user: UserRow, app: GitHubApp): Promise<string> {
    const soon = Date.now() + 60_000;
    if (!user.access_expires_at || user.access_expires_at.getTime() > soon) return decrypt(user.access_token, this.key);
    if (!user.refresh_token || (user.refresh_expires_at && user.refresh_expires_at.getTime() < Date.now())) throw new AccessRevoked();
    const t = await app.refresh(decrypt(user.refresh_token, this.key));
    await this.db.query(
      `UPDATE users SET access_token=$2, access_expires_at=$3, refresh_token=COALESCE($4, refresh_token), refresh_expires_at=COALESCE($5, refresh_expires_at) WHERE id=$1`,
      [user.id, encrypt(t.accessToken, this.key), t.accessExpiresAt, t.refreshToken ? encrypt(t.refreshToken, this.key) : null, t.refreshExpiresAt],
    );
    return t.accessToken;
  }

  settings(user: UserRow): Settings {
    return { ...DEFAULT_SETTINGS, ...user.settings };
  }

  async saveSettings(userId: string, s: Settings): Promise<void> {
    await this.db.query('UPDATE users SET settings = $2 WHERE id = $1', [userId, JSON.stringify(s)]);
  }

  /** Disconnect: delete the user's tokens, sessions, watches and settings. */
  async deleteUser(userId: string): Promise<string[]> {
    return transaction(this.db, async (tx) => {
      const { rows } = await tx.query<{ repository_id: string }>('SELECT repository_id FROM watches WHERE user_id = $1', [userId]);
      await tx.query('DELETE FROM users WHERE id = $1', [userId]);
      await this.markUnwatched(tx, rows.map((r) => r.repository_id));
      return rows.map((r) => r.repository_id);
    });
  }

  // ---- Watches ---------------------------------------------------------------------------

  async watched(userId: string): Promise<RepositoryRow[]> {
    const { rows } = await this.db.query<RepositoryRow>(
      `SELECT r.* FROM watches w JOIN repositories r ON r.id = w.repository_id WHERE w.user_id = $1 ORDER BY r.full_name`, [userId]);
    return rows;
  }

  /** Replace the watch list. Returns repositories newly watched, which need a first sync. */
  async setWatches(userId: string, repos: Omit<RepositoryRow, 'last_synced_at' | 'sync_error'>[]): Promise<string[]> {
    return transaction(this.db, async (tx) => {
      for (const r of repos) {
        await tx.query(
          `INSERT INTO repositories (id, owner, name, full_name, private, url, installation_id) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET owner=$2, name=$3, full_name=$4, private=$5, url=$6,
             installation_id=COALESCE($7, repositories.installation_id), unwatched_at=NULL`,
          [r.id, r.owner, r.name, r.full_name, r.private, r.url, r.installation_id],
        );
      }
      const ids = repos.map((r) => r.id);
      const { rows: before } = await tx.query<{ repository_id: string }>('SELECT repository_id FROM watches WHERE user_id = $1', [userId]);
      const removed = before.map((r) => r.repository_id).filter((id) => !ids.includes(id));
      await tx.query('DELETE FROM watches WHERE user_id = $1 AND NOT (repository_id = ANY($2::bigint[]))', [userId, ids]);
      const { rows: added } = await tx.query<{ repository_id: string }>(
        `INSERT INTO watches (user_id, repository_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING RETURNING repository_id`, [userId, ids]);
      await this.markUnwatched(tx, removed);
      const { rows: unsynced } = await tx.query<{ id: string }>('SELECT id FROM repositories WHERE id = ANY($1::bigint[]) AND last_synced_at IS NULL', [ids]);
      return [...new Set([...added.map((r) => r.repository_id), ...unsynced.map((r) => r.id)])];
    });
  }

  async unwatch(userId: string, repositoryId: string): Promise<void> {
    await transaction(this.db, async (tx) => {
      await tx.query('DELETE FROM watches WHERE user_id = $1 AND repository_id = $2', [userId, repositoryId]);
      await tx.query('DELETE FROM access_checks WHERE user_id = $1 AND repository_id = $2', [userId, repositoryId]);
      await this.markUnwatched(tx, [repositoryId]);
    });
  }

  private async markUnwatched(tx: { query: Db['query'] }, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await tx.query(
      `UPDATE repositories r SET unwatched_at = now() WHERE r.id = ANY($1::bigint[]) AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.repository_id = r.id)`,
      [ids],
    );
  }

  // ---- Access checks -------------------------------------------------------------------

  async freshAccess(userId: string, minutes: number): Promise<Map<string, boolean>> {
    const { rows } = await this.db.query<{ repository_id: string; ok: boolean }>(
      `SELECT repository_id, ok FROM access_checks WHERE user_id = $1 AND checked_at > now() - ($2 || ' minutes')::interval`, [userId, String(minutes)]);
    return new Map(rows.map((r) => [r.repository_id, r.ok]));
  }

  async recordAccess(userId: string, repositoryId: string, ok: boolean): Promise<void> {
    await this.db.query(
      `INSERT INTO access_checks (user_id, repository_id, ok, checked_at) VALUES ($1,$2,$3, now())
       ON CONFLICT (user_id, repository_id) DO UPDATE SET ok = $3, checked_at = now()`, [userId, repositoryId, ok]);
  }

  async logAccess(userId: string, repos: RepositoryRow[], endpoint: string): Promise<void> {
    const priv = repos.filter((r) => r.private);
    if (!priv.length) return;
    await this.db.query(
      'INSERT INTO access_log (user_id, repository_id, endpoint) SELECT $1, unnest($2::bigint[]), $3', [userId, priv.map((r) => r.id), endpoint]);
  }

  // ---- Repository data -----------------------------------------------------------------

  /** Build the rules engine's dataset from stored rows for the given repositories. */
  async dataset(repos: RepositoryRow[], viewer: string, settings: Settings, now = new Date()): Promise<Dataset> {
    const ids = repos.map((r) => r.id);
    const [items, milestones, closures] = await Promise.all([
      this.db.query<{ repository_id: string; data: Item }>('SELECT repository_id, data FROM items WHERE repository_id = ANY($1::bigint[])', [ids]),
      this.db.query<{ repository_id: string; number: number; title: string; due_on: Date | string | null; open_count: number; closed_count: number; url: string }>(
        'SELECT * FROM milestones WHERE repository_id = ANY($1::bigint[])', [ids]),
      this.db.query<{ repository_id: string; milestone_number: number; closed_at: Date }>(
        'SELECT repository_id, milestone_number, closed_at FROM milestone_closures WHERE repository_id = ANY($1::bigint[])', [ids]),
    ]);
    const nowMs = now.getTime();
    const repositories: Repository[] = repos.map((r) => {
      const ms: Milestone[] = milestones.rows.filter((m) => m.repository_id === r.id).map((m) => {
        const closed_in_window: Record<number, number> = {};
        for (const w of [7, 14, 30]) {
          closed_in_window[w] = closures.rows.filter((c) => c.repository_id === r.id && c.milestone_number === m.number
            && nowMs - new Date(c.closed_at).getTime() <= w * 86_400_000).length;
        }
        const due = m.due_on == null ? null : typeof m.due_on === 'string' ? m.due_on.slice(0, 10) : m.due_on.toISOString().slice(0, 10);
        return { title: m.title, due, open: m.open_count, closed: m.closed_count, closed_in_window, url: m.url };
      });
      return {
        full_name: r.full_name, owner: r.owner, name: r.name, url: r.url, unlisted_backlog_issues: 0, milestones: ms,
        last_synced_at: r.last_synced_at?.toISOString() ?? null,
        sync_state: r.sync_error ? 'error' : r.last_synced_at ? 'ok' : 'pending',
        sync_error: r.sync_error,
      };
    });
    return {
      today: now.toISOString().slice(0, 10),
      now: now.toISOString(),
      viewer,
      settings,
      repositories,
      items: items.rows.map((r) => r.data),
    };
  }

  async repository(id: string): Promise<RepositoryRow | null> {
    const { rows } = await this.db.query<RepositoryRow>('SELECT * FROM repositories WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async repositoryByName(fullName: string): Promise<RepositoryRow | null> {
    const { rows } = await this.db.query<RepositoryRow>('SELECT * FROM repositories WHERE lower(full_name) = lower($1)', [fullName]);
    return rows[0] ?? null;
  }

  async watchedRepositoryIds(): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>('SELECT DISTINCT repository_id AS id FROM watches');
    return rows.map((r) => r.id);
  }

  /** Any watcher's user, for reading a public repository the app is not installed on. */
  async aWatcher(repositoryId: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT u.* FROM watches w JOIN users u ON u.id = w.user_id WHERE w.repository_id = $1 ORDER BY w.created_at LIMIT 1', [repositoryId]);
    return rows[0] ?? null;
  }

  async recordSyncError(repositoryId: string, message: string): Promise<void> {
    await this.db.query('UPDATE repositories SET sync_error = $2, sync_error_at = now() WHERE id = $1', [repositoryId, message]);
  }

  async setInstallation(repositoryId: string, installationId: number | null): Promise<void> {
    await this.db.query('UPDATE repositories SET installation_id = $2 WHERE id = $1', [repositoryId, installationId]);
  }

  async clearInstallation(installationId: number): Promise<void> {
    await this.db.query('UPDATE repositories SET installation_id = NULL WHERE installation_id = $1', [installationId]);
  }

  async recordDelivery(d: { id: string; event: string; action: string | null; repository: string | null; installation: number | null }): Promise<boolean> {
    const res = await this.db.query(
      `INSERT INTO webhook_deliveries (id, event, action, repository, installation) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [d.id, d.event, d.action, d.repository, d.installation]);
    return (res.rowCount ?? 0) > 0;
  }

  async markDelivered(id: string): Promise<void> {
    await this.db.query('UPDATE webhook_deliveries SET processed_at = now() WHERE id = $1', [id]);
  }

  /** Delete data for repositories nobody has watched for the grace period. */
  async purgeUnwatched(graceDays: number): Promise<number> {
    const res = await this.db.query(
      `DELETE FROM repositories r WHERE r.unwatched_at < now() - ($1 || ' days')::interval AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.repository_id = r.id)`,
      [String(graceDays)]);
    await this.db.query(`DELETE FROM sessions WHERE expires_at < now()`);
    await this.db.query(`DELETE FROM webhook_deliveries WHERE received_at < now() - interval '14 days'`);
    return res.rowCount ?? 0;
  }
}
