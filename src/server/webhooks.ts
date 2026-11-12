// GitHub webhook deliveries. Each is verified by its signature; only its metadata is
// stored, and the affected repository is re-synced by a job.

import { verify } from '@octokit/webhooks-methods';
import type { Jobs } from './jobs.js';
import type { Store } from './store.js';

export const SYNC_EVENTS = new Set([
  'issues', 'pull_request', 'pull_request_review', 'pull_request_review_comment', 'pull_request_review_thread',
  'check_run', 'check_suite', 'status', 'milestone', 'label',
]);

export async function verifySignature(secret: string, body: string, signature: string | undefined): Promise<boolean> {
  if (!signature || !signature.startsWith('sha256=')) return false;
  try {
    return await verify(secret, body, signature);
  } catch {
    return false;
  }
}

interface Payload {
  action?: string;
  repository?: { id: number; full_name: string };
  installation?: { id: number };
  repositories_added?: { id: number; full_name: string }[];
  repositories_removed?: { id: number; full_name: string }[];
}

export async function handleDelivery(store: Store, jobs: Jobs, id: string, event: string, payload: Payload): Promise<void> {
  const fresh = await store.recordDelivery({
    id, event, action: payload.action ?? null,
    repository: payload.repository?.full_name ?? null, installation: payload.installation?.id ?? null,
  });
  if (!fresh) return; // a redelivery we have already handled

  if (event === 'installation' && (payload.action === 'deleted' || payload.action === 'suspend') && payload.installation) {
    await store.clearInstallation(payload.installation.id);
  } else if (event === 'installation_repositories' && payload.installation) {
    for (const r of payload.repositories_removed ?? []) await store.setInstallation(String(r.id), null);
    for (const r of payload.repositories_added ?? []) {
      const stored = await store.repository(String(r.id));
      if (stored) {
        await store.setInstallation(stored.id, payload.installation.id);
        await jobs.enqueueSync(stored.id);
      }
    }
  } else if (SYNC_EVENTS.has(event) && payload.repository) {
    const stored = await store.repository(String(payload.repository.id));
    if (stored) await jobs.enqueueSync(stored.id);
  }
  await store.markDelivered(id);
}
