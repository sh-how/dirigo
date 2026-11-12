// Background jobs on a Postgres-backed queue: first sync, webhook processing,
// periodic reconciliation and cleanup.

import { PgBoss } from 'pg-boss';
import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import { AccessRevoked, GitHubApp, NotFound, RateLimited } from './github/client.js';
import { fetchRepository, storeRepository } from './github/sync.js';
import { Store } from './store.js';

export const QUEUES = {
  sync: 'sync-repository',
  reconcile: 'reconcile',
  cleanup: 'cleanup',
} as const;

export interface Jobs {
  boss: PgBoss;
  enqueueSync(repositoryId: string, startAfter?: Date): Promise<void>;
}

export async function createJobs(cfg: Config): Promise<Jobs> {
  const boss = new PgBoss(cfg.databaseUrl!);
  boss.on('error', (err) => console.error('[jobs]', err));
  await boss.start();
  await boss.createQueue(QUEUES.sync, { policy: 'stately', retryLimit: 3, retryDelay: 30, retryBackoff: true });
  await boss.createQueue(QUEUES.reconcile);
  await boss.createQueue(QUEUES.cleanup);
  return {
    boss,
    async enqueueSync(repositoryId, startAfter) {
      await boss.send(QUEUES.sync, { repositoryId }, { singletonKey: repositoryId, ...(startAfter ? { startAfter } : {}) });
    },
  };
}

/** Choose a token that can read the repository: the installation's, else a watcher's. */
async function tokenFor(store: Store, app: GitHubApp, repoId: string): Promise<{ token: string; installationId: number | null }> {
  const repo = await store.repository(repoId);
  if (!repo) throw new NotFound(`Repository ${repoId} is not stored`);
  let installationId = repo.installation_id ? Number(repo.installation_id) : null;
  if (!installationId) {
    installationId = await app.installationFor(repo.owner, repo.name);
    if (installationId) await store.setInstallation(repoId, installationId);
  }
  if (installationId) return { token: await app.installationToken(installationId), installationId };
  if (repo.private) throw new AccessRevoked('Dirigo is not installed on this private repository');
  const watcher = await store.aWatcher(repoId);
  if (!watcher) throw new NotFound('Nobody watches this repository');
  return { token: await store.userToken(watcher, app), installationId: null };
}

export async function startWorkers(cfg: Config, db: Db, jobs: Jobs, app: GitHubApp, store: Store): Promise<void> {
  const { boss } = jobs;

  await boss.work<{ repositoryId: string }>(QUEUES.sync, async ([job]) => {
    const id = job.data.repositoryId;
    const repo = await store.repository(id);
    if (!repo) return;
    try {
      const { token, installationId } = await tokenFor(store, app, id);
      const fetched = await fetchRepository(token, repo.owner, repo.name);
      const res = await storeRepository(db, fetched, installationId);
      console.log(`[sync] ${repo.full_name}: ${res.issues} issues, ${res.pullRequests} pull requests, ${res.milestones} milestones`);
    } catch (err) {
      if (err instanceof RateLimited) {
        // Keep the stored data and try again once the limit resets.
        await store.recordSyncError(id, 'rate_limited');
        await jobs.enqueueSync(id, err.retryAt);
        return;
      }
      if (err instanceof NotFound) {
        await store.recordSyncError(id, 'not_found');
        return;
      }
      if (err instanceof AccessRevoked) {
        await store.recordSyncError(id, 'access_revoked');
        return;
      }
      await store.recordSyncError(id, 'unreachable');
      throw err;
    }
  });

  await boss.work(QUEUES.reconcile, async () => {
    for (const id of await store.watchedRepositoryIds()) await jobs.enqueueSync(id);
  });

  await boss.work(QUEUES.cleanup, async () => {
    const n = await store.purgeUnwatched(cfg.unwatchedGraceDays);
    if (n) console.log(`[cleanup] removed data for ${n} unwatched repositories`);
  });

  await boss.schedule(QUEUES.reconcile, cfg.reconcileCron);
  await boss.schedule(QUEUES.cleanup, '17 3 * * *');
}
