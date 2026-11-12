// Reads one repository from GitHub and replaces its stored metadata in a single
// transaction, so a failed or rate-limited sync never leaves partial data.

import type { Db } from '../db/pool.js';
import { transaction } from '../db/pool.js';
import type { IssueItem, PullRequestItem } from '../../shared/types.js';
import { gql } from './client.js';
import { linkIssues, mapIssue, mapPullRequest, type IssueNode, type PullRequestNode } from './map.js';
import {
  CLOSED_ISSUES_QUERY, CLOSED_PULL_REQUESTS_QUERY, ISSUES_QUERY, PULL_REQUESTS_QUERY, REPOSITORY_QUERY,
} from './queries.js';

/** Closures are kept for the longest pace window offered in Settings. */
export const CLOSURE_DAYS = 30;

interface Page<T> { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] }

interface RepoInfo {
  databaseId: number;
  nameWithOwner: string;
  name: string;
  url: string;
  isPrivate: boolean;
  owner: { login: string };
  milestones: {
    nodes: {
      number: number; title: string; dueOn: string | null; url: string;
      openIssues: { totalCount: number }; closedIssues: { totalCount: number };
      openPullRequests: { totalCount: number }; closedPullRequests: { totalCount: number };
    }[];
  };
}

export interface SyncResult {
  repositoryId: number;
  issues: number;
  pullRequests: number;
  milestones: number;
}

async function all<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>, stop?: (node: T) => boolean, maxPages = 100): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    for (const n of page.nodes) {
      if (!n) continue;
      if (stop?.(n)) return out;
      out.push(n);
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return out;
}

export async function fetchRepository(token: string, owner: string, name: string, now = new Date()) {
  const vars = { owner, name };
  const info = await gql<{ repository: RepoInfo | null }>(token, REPOSITORY_QUERY, vars);
  if (!info.repository) throw new Error(`Repository ${owner}/${name} not found`);
  const repo = info.repository;
  const fullName = repo.nameWithOwner;

  const issueNodes = await all<IssueNode>(async (cursor) =>
    (await gql<{ repository: { issues: Page<IssueNode> } }>(token, ISSUES_QUERY, { ...vars, cursor })).repository.issues);
  const prNodes = await all<PullRequestNode>(async (cursor) =>
    (await gql<{ repository: { pullRequests: Page<PullRequestNode> } }>(token, PULL_REQUESTS_QUERY, { ...vars, cursor })).repository.pullRequests);

  const since = new Date(now.getTime() - CLOSURE_DAYS * 86_400_000).toISOString();
  type Closed = { number: number; closedAt: string | null; updatedAt?: string; milestone: { number: number } | null };
  const closedIssues = await all<Closed>(async (cursor) =>
    (await gql<{ repository: { issues: Page<Closed> } }>(token, CLOSED_ISSUES_QUERY, { ...vars, since, cursor })).repository.issues);
  const closedPrs = await all<Closed>(async (cursor) =>
    (await gql<{ repository: { pullRequests: Page<Closed> } }>(token, CLOSED_PULL_REQUESTS_QUERY, { ...vars, cursor })).repository.pullRequests,
  (n) => !!n.updatedAt && n.updatedAt < since);

  const issues: IssueItem[] = issueNodes.map((n) => mapIssue(fullName, n));
  linkIssues(fullName, issues, prNodes);
  const prs: PullRequestItem[] = prNodes.map((n) => mapPullRequest(fullName, n));
  const closures = [...closedIssues, ...closedPrs]
    .filter((c) => c.milestone && c.closedAt && c.closedAt >= since)
    .map((c) => ({ number: c.number, milestone: c.milestone!.number, closedAt: c.closedAt! }));

  return { repo, issues, prs, closures };
}

export async function storeRepository(db: Db, fetched: Awaited<ReturnType<typeof fetchRepository>>, installationId: number | null): Promise<SyncResult> {
  const { repo, issues, prs, closures } = fetched;
  const id = repo.databaseId;
  await transaction(db, async (tx) => {
    await tx.query(
      `INSERT INTO repositories (id, owner, name, full_name, private, url, installation_id, last_synced_at, sync_error, sync_error_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), NULL, NULL)
       ON CONFLICT (id) DO UPDATE SET owner=$2, name=$3, full_name=$4, private=$5, url=$6,
         installation_id=COALESCE($7, repositories.installation_id), last_synced_at=now(), sync_error=NULL, sync_error_at=NULL`,
      [id, repo.owner.login, repo.name, repo.nameWithOwner, repo.isPrivate, repo.url, installationId],
    );
    await tx.query('DELETE FROM items WHERE repository_id = $1', [id]);
    for (const item of [...issues, ...prs]) {
      await tx.query('INSERT INTO items (repository_id, number, kind, data, updated_at) VALUES ($1,$2,$3,$4,$5)',
        [id, item.number, item.kind, JSON.stringify(item), item.last_activity]);
    }
    await tx.query('DELETE FROM milestones WHERE repository_id = $1', [id]);
    for (const m of repo.milestones.nodes) {
      await tx.query(
        'INSERT INTO milestones (repository_id, number, title, due_on, open_count, closed_count, url) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, m.number, m.title, m.dueOn ? m.dueOn.slice(0, 10) : null,
          m.openIssues.totalCount + m.openPullRequests.totalCount, m.closedIssues.totalCount + m.closedPullRequests.totalCount, m.url],
      );
    }
    await tx.query('DELETE FROM milestone_closures WHERE repository_id = $1', [id]);
    for (const c of closures) {
      await tx.query(
        'INSERT INTO milestone_closures (repository_id, item_number, milestone_number, closed_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [id, c.number, c.milestone, c.closedAt],
      );
    }
    await tx.query('DELETE FROM item_events WHERE repository_id = $1', [id]);
    for (const pr of prs) {
      if (pr.waiting_since) {
        const kind = pr.checks === 'failing' ? 'checks_failed' : pr.review_decision === 'CHANGES_REQUESTED' ? 'changes_requested' : 'review_requested';
        const at = pr.checks === 'failing' ? pr.checks_failing_since ?? pr.waiting_since : pr.waiting_since;
        await tx.query('INSERT INTO item_events (repository_id, item_number, kind, occurred_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [id, pr.number, kind, at]);
      }
    }
  });
  return { repositoryId: id, issues: issues.length, pullRequests: prs.length, milestones: repo.milestones.nodes.length };
}
