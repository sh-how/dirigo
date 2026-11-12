// The rules engine: a pure module that classifies every open item and projects every
// milestone, as defined in docs/04-data-and-rules.md. No I/O.

import { addDays, daysBetween, dateOnly } from './dates.js';
import type {
  Bucket, Dataset, InProgressRule, Item, Milestone, PullRequestItem, Repository, Settings, Stage,
} from './types.js';
import { STAGES } from './types.js';

export type WaitReason = 'review' | 'changes_requested' | 'checks_failing' | 'in_progress' | null;
export type BlockReason = 'stalled_review' | 'checks_failing' | 'stalled_revision' | 'stalled_work' | 'stalled_pull_request';
export type PullRequestState = 'draft' | 'changes_requested' | 'ready_to_merge' | 'approved' | 'checks_failing' | 'open';

/** Shown when a pull request needs review but nobody was asked (open question 9). */
export const ANY_REVIEWER = 'any reviewer';

export interface Classified {
  item: Item;
  key: string; // owner/name#number
  stage: Stage;
  bucket: Bucket;
  waiting_on: string[];
  wait_reason: WaitReason;
  waiting_since: string | null;
  wait_days: number | null;
  idle_days: number;
  stalled: boolean;
  failing_long: boolean;
  blocked: boolean;
  block_reason: BlockReason | null;
  /** Days the blocking condition has lasted, and since when. */
  blocked_days: number | null;
  blocked_since: string | null;
  waiting_on_you: boolean;
  past_review_target: boolean;
  no_owner: boolean;
  ready_to_merge: boolean;
  pr_state: PullRequestState | null;
  /** The item's milestone, when the repository has it with a due date. */
  milestone: Milestone | null;
}

export type MilestoneStatus = 'late' | 'at_risk' | 'on_track';
export type RepositoryStatus = 'behind' | 'at_risk' | 'on_track';

export interface Projection {
  repository: string;
  milestone: Milestone;
  due: string;
  days_left: number;
  percent_done: number;
  pace: number;
  landing: string | null;
  difference_days: number | null;
  status: MilestoneStatus;
  blocked: Classified[];
}

export interface RepositorySummary {
  repository: Repository;
  items: Classified[];
  stage_counts: Record<Stage, number>;
  open_items: number;
  blocked: Classified[];
  waiting_on_you: Classified[];
  no_owner: number;
  status: RepositoryStatus;
  /** Problem headline of the most severe blocked item, or null when nothing is stuck. */
  worst: Classified | null;
  stuck_stage: Stage | null;
  next_milestone: Projection | null;
  milestones: Projection[];
}

export interface Analysis {
  dataset: Dataset;
  items: Classified[];
  repositories: RepositorySummary[]; // sorted worst first
  stage_counts: Record<Stage, number>;
  open_items: number;
  buckets: Record<Bucket, number>;
  blocked: Classified[]; // sorted
  waiting_on_you: Classified[]; // sorted, bucket "needs your decision" only
  no_owner: number;
  milestones: Projection[]; // sorted
}

function emptyStages(): Record<Stage, number> {
  return { backlog: 0, in_progress: 0, needs_review: 0, open_pull_requests: 0 };
}

export function itemKey(item: Pick<Item, 'repository' | 'number'>): string {
  return `${item.repository}#${item.number}`;
}

function isInProgress(item: Extract<Item, { kind: 'issue' }>, rule: InProgressRule, settings: Settings): boolean {
  switch (rule) {
    case 'linked_pull_request':
      return item.linked_open_pull_request != null;
    case 'assigned':
      return item.assignees.length > 0;
    case 'label': {
      const wanted = settings.in_progress_label?.toLowerCase();
      return !!wanted && item.labels.some((l) => l.toLowerCase() === wanted);
    }
    case 'project_column': {
      const wanted = settings.in_progress_label?.toLowerCase();
      return !!wanted && item.project_column?.toLowerCase() === wanted;
    }
  }
}

function needsReview(pr: PullRequestItem): boolean {
  if (pr.draft) return false;
  if (pr.review_decision === 'REVIEW_REQUIRED') return true;
  // Open question 9: with no review required, a pull request nobody has reviewed yet needs review.
  return pr.review_decision === null && !pr.reviewed;
}

function datedMilestone(repo: Repository | undefined, title: string | null): Milestone | null {
  if (!repo || !title) return null;
  const m = repo.milestones.find((x) => x.title === title);
  return m && m.due ? m : null;
}

export function classify(item: Item, ds: Dataset, repo?: Repository): Classified {
  const { settings, today, viewer } = ds;
  const since = (iso: string | null | undefined) => (iso ? Math.max(0, daysBetween(iso, today)) : null);
  const idle = since(item.last_activity) ?? 0;
  const milestone = datedMilestone(repo, item.milestone);

  let stage: Stage;
  let waitingOn: string[] = [];
  let reason: WaitReason = null;
  let waitingSince: string | null = null;
  let stalled = false;
  let failingLong = false;
  let prState: PullRequestState | null = null;

  if (item.kind === 'issue') {
    stage = isInProgress(item, settings.in_progress_rule, settings) ? 'in_progress' : 'backlog';
    if (stage === 'in_progress') {
      waitingOn = item.assignees;
      reason = 'in_progress';
      waitingSince = item.last_activity;
      stalled = idle >= settings.stalled_after_days;
    }
  } else {
    stage = needsReview(item) ? 'needs_review' : 'open_pull_requests';
    if (item.checks === 'failing') {
      waitingOn = [item.author];
      reason = 'checks_failing';
      waitingSince = item.checks_failing_since ?? item.last_activity;
    } else if (stage === 'needs_review') {
      waitingOn = item.requested_reviewers.length ? item.requested_reviewers : [ANY_REVIEWER];
      reason = 'review';
      waitingSince = item.waiting_since ?? item.created ?? item.last_activity;
    } else if (item.review_decision === 'CHANGES_REQUESTED') {
      waitingOn = [item.author];
      reason = 'changes_requested';
      waitingSince = item.waiting_since ?? item.last_activity;
    }
    const wait = since(waitingSince);
    stalled = (wait !== null && wait >= settings.stalled_after_days) || idle >= settings.stalled_after_days;
    failingLong = item.checks === 'failing' && (since(item.checks_failing_since ?? item.last_activity) ?? 0) > settings.failing_checks_block_after_days;

    if (item.draft) prState = 'draft';
    else if (item.review_decision === 'CHANGES_REQUESTED') prState = 'changes_requested';
    else if (item.checks === 'failing') prState = 'checks_failing';
    else if (item.review_decision === 'APPROVED') prState = item.checks === 'passing' ? 'ready_to_merge' : 'approved';
    else prState = 'open';
  }

  const waitDays = since(waitingSince);
  const blocked = milestone !== null && (stalled || failingLong);

  let blockReason: BlockReason | null = null;
  let blockedDays: number | null = null;
  let blockedSince: string | null = null;
  if (blocked) {
    if (failingLong && item.kind === 'pull_request') {
      blockReason = 'checks_failing';
      blockedSince = item.checks_failing_since ?? item.last_activity;
    } else {
      const byWait = waitDays !== null && waitDays >= settings.stalled_after_days;
      blockedSince = byWait ? waitingSince : item.last_activity;
      if (item.kind === 'issue') blockReason = 'stalled_work';
      else if (byWait && reason === 'review') blockReason = 'stalled_review';
      else if (byWait && reason === 'changes_requested') blockReason = 'stalled_revision';
      else blockReason = 'stalled_pull_request';
    }
    blockedDays = since(blockedSince);
  }

  const waitingOnYou = item.kind === 'pull_request' && waitingOn.includes(viewer);
  const bucket: Bucket = blocked ? 'blocked' : waitingOnYou ? 'needs_your_decision' : 'on_track';

  return {
    item,
    key: itemKey(item),
    stage,
    bucket,
    waiting_on: waitingOn,
    wait_reason: reason,
    waiting_since: waitingSince,
    wait_days: waitDays,
    idle_days: idle,
    stalled,
    failing_long: failingLong,
    blocked,
    block_reason: blockReason,
    blocked_days: blockedDays,
    blocked_since: blockedSince,
    waiting_on_you: waitingOnYou,
    past_review_target: stage === 'needs_review' && waitDays !== null && waitDays > settings.review_target_days,
    no_owner: item.kind === 'issue' && item.assignees.length === 0,
    ready_to_merge: prState === 'ready_to_merge',
    pr_state: prState,
    milestone,
  };
}

// ---- Sorting -------------------------------------------------------------------------------

const FAR_FUTURE = '9999-12-31';

export function compareBlocked(a: Classified, b: Classified): number {
  const due = (a.milestone?.due ?? FAR_FUTURE).localeCompare(b.milestone?.due ?? FAR_FUTURE);
  if (due !== 0) return due;
  return (b.blocked_days ?? 0) - (a.blocked_days ?? 0);
}

export function compareWaiting(a: Classified, b: Classified): number {
  return (b.wait_days ?? 0) - (a.wait_days ?? 0);
}

/** Cards in a cell: blocked, then waiting on you, then no owner, then most recently updated. */
export function compareCards(a: Classified, b: Classified): number {
  const rank = (c: Classified) => (c.blocked ? 0 : c.waiting_on_you ? 1 : c.no_owner ? 2 : 3);
  const r = rank(a) - rank(b);
  if (r !== 0) return r;
  if (a.blocked && b.blocked) return compareBlocked(a, b);
  if (a.waiting_on_you && b.waiting_on_you) return compareWaiting(a, b);
  const t = b.item.last_activity.localeCompare(a.item.last_activity);
  return t !== 0 ? t : b.item.number - a.item.number;
}

const REPO_RANK: Record<RepositoryStatus, number> = { behind: 0, at_risk: 1, on_track: 2 };
const MILESTONE_RANK: Record<MilestoneStatus, number> = { late: 0, at_risk: 1, on_track: 2 };

export function compareRepositories(a: RepositorySummary, b: RepositorySummary): number {
  const r = REPO_RANK[a.status] - REPO_RANK[b.status];
  if (r !== 0) return r;
  const due = (a.next_milestone?.due ?? FAR_FUTURE).localeCompare(b.next_milestone?.due ?? FAR_FUTURE);
  return due !== 0 ? due : a.repository.full_name.localeCompare(b.repository.full_name);
}

export function compareMilestones(a: Projection, b: Projection): number {
  const r = MILESTONE_RANK[a.status] - MILESTONE_RANK[b.status];
  if (r !== 0) return r;
  const due = a.due.localeCompare(b.due);
  return due !== 0 ? due : a.repository.localeCompare(b.repository);
}

// ---- Milestone projection ------------------------------------------------------------------

export function project(repo: Repository, milestone: Milestone, items: Classified[], ds: Dataset): Projection | null {
  if (!milestone.due) return null;
  const { today, settings } = ds;
  const total = milestone.open + milestone.closed;
  const percent = total === 0 ? 0 : Math.round((100 * milestone.closed) / total);
  const window = settings.pace_window_days;
  const closedInWindow = milestone.closed_in_window[window] ?? 0;
  const pace = closedInWindow / window;
  const blocked = items.filter((c) => c.blocked && c.item.milestone === milestone.title).sort(compareBlocked);

  let landing: string | null = null;
  let difference: number | null = null;
  let status: MilestoneStatus;
  if (milestone.open === 0) {
    landing = today;
    difference = daysBetween(today, milestone.due);
  } else if (pace > 0) {
    landing = addDays(today, Math.ceil(milestone.open / pace));
    difference = daysBetween(landing, milestone.due);
  }
  if (difference === null || difference < 0) status = 'late';
  else if (difference === 0 || (blocked.length > 0 && difference < 2)) status = 'at_risk';
  else status = 'on_track';

  return {
    repository: repo.full_name,
    milestone,
    due: dateOnly(milestone.due),
    days_left: daysBetween(today, milestone.due),
    percent_done: percent,
    pace,
    landing,
    difference_days: difference,
    status,
    blocked,
  };
}

// ---- The whole dataset ---------------------------------------------------------------------

export function analyse(ds: Dataset): Analysis {
  const repoByName = new Map(ds.repositories.map((r) => [r.full_name, r]));
  const items = ds.items
    .filter((i) => repoByName.has(i.repository))
    .map((i) => classify(i, ds, repoByName.get(i.repository)));

  const repositories: RepositorySummary[] = ds.repositories.map((repo) => {
    const mine = items.filter((c) => c.item.repository === repo.full_name);
    const counts = emptyStages();
    for (const c of mine) counts[c.stage] += 1;
    counts.backlog += repo.unlisted_backlog_issues;
    const blocked = mine.filter((c) => c.blocked).sort(compareBlocked);
    const projections = repo.milestones
      .map((m) => project(repo, m, mine, ds))
      .filter((p): p is Projection => p !== null)
      .sort((a, b) => a.due.localeCompare(b.due));
    const next = projections[0] ?? null;
    const status: RepositoryStatus =
      next?.status === 'late' ? 'behind' : blocked.length > 0 || next?.status === 'at_risk' ? 'at_risk' : 'on_track';
    const worst = blocked[0] ?? null;
    return {
      repository: repo,
      items: mine,
      stage_counts: counts,
      open_items: STAGES.reduce((n, s) => n + counts[s], 0),
      blocked,
      waiting_on_you: mine.filter((c) => c.bucket === 'needs_your_decision').sort(compareWaiting),
      no_owner: mine.filter((c) => c.no_owner).length,
      status,
      worst,
      stuck_stage: worst?.stage ?? null,
      next_milestone: next,
      milestones: projections,
    };
  });
  repositories.sort(compareRepositories);

  const stageCounts = emptyStages();
  for (const r of repositories) for (const s of STAGES) stageCounts[s] += r.stage_counts[s];
  const unlisted = ds.repositories.reduce((n, r) => n + r.unlisted_backlog_issues, 0);
  const buckets: Record<Bucket, number> = { blocked: 0, needs_your_decision: 0, on_track: unlisted };
  for (const c of items) buckets[c.bucket] += 1;

  return {
    dataset: ds,
    items,
    repositories,
    stage_counts: stageCounts,
    open_items: STAGES.reduce((n, s) => n + stageCounts[s], 0),
    buckets,
    blocked: items.filter((c) => c.blocked).sort(compareBlocked),
    waiting_on_you: items.filter((c) => c.bucket === 'needs_your_decision').sort(compareWaiting),
    no_owner: items.filter((c) => c.no_owner).length,
    milestones: repositories.flatMap((r) => r.milestones).sort(compareMilestones),
  };
}
