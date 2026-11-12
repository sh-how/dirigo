// Pure mapping from GitHub GraphQL nodes to the items the rules engine reads.

import type { ChecksState, IssueItem, PullRequestItem, ReviewDecision } from '../../shared/types.js';

type Login = { login: string } | null;

export interface IssueNode {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  assignees: { nodes: Login[] };
  labels: { nodes: { name: string }[] } | null;
  milestone: { title: string } | null;
}

type Reviewer = { __typename: string; login?: string; slug?: string } | null;

export interface PullRequestNode {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: ReviewDecision;
  changedFiles: number;
  author: Login;
  assignees: { nodes: Login[] };
  labels: { nodes: { name: string }[] } | null;
  milestone: { title: string } | null;
  reviewRequests: { nodes: { requestedReviewer: Reviewer }[] } | null;
  latestReviews: { nodes: { author: Login; state: string; submittedAt: string | null }[] } | null;
  closingIssuesReferences: { nodes: { number: number; repository: { nameWithOwner: string } }[] } | null;
  statusCheckRollup: {
    state: string;
    contexts: { nodes: ({ __typename: 'CheckRun'; conclusion: string | null; status: string; startedAt: string | null; completedAt: string | null }
      | { __typename: 'StatusContext'; state: string; createdAt: string })[] };
  } | null;
  timelineItems: { nodes: ({ __typename: 'ReviewRequestedEvent'; createdAt: string; requestedReviewer: Reviewer }
    | { __typename: 'ReadyForReviewEvent'; createdAt: string } | { __typename: string; createdAt?: string })[] };
}

function reviewerName(r: Reviewer): string | null {
  if (!r) return null;
  if (r.login) return r.login;
  if (r.slug) return `@${r.slug}`;
  return null;
}

const FAILED_CONCLUSIONS = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);

function checks(pr: PullRequestNode): { state: ChecksState; failingSince: string | null; failing: number } {
  const roll = pr.statusCheckRollup;
  if (!roll) return { state: 'none', failingSince: null, failing: 0 };
  let failingSince: string | null = null;
  let failing = 0;
  for (const c of roll.contexts?.nodes ?? []) {
    if (!c) continue;
    let when: string | null = null;
    if (c.__typename === 'CheckRun') {
      const run = c as Extract<typeof c, { __typename: 'CheckRun' }>;
      if (run.conclusion && FAILED_CONCLUSIONS.has(run.conclusion)) when = run.completedAt ?? run.startedAt;
      else continue;
    } else if (c.__typename === 'StatusContext') {
      const st = c as Extract<typeof c, { __typename: 'StatusContext' }>;
      if (st.state === 'FAILURE' || st.state === 'ERROR') when = st.createdAt;
      else continue;
    } else continue;
    failing += 1;
    if (when && (!failingSince || when < failingSince)) failingSince = when;
  }
  const state: ChecksState = roll.state === 'SUCCESS' ? 'passing'
    : roll.state === 'FAILURE' || roll.state === 'ERROR' ? 'failing'
    : roll.state === 'PENDING' || roll.state === 'EXPECTED' ? 'pending' : 'none';
  return { state, failingSince: state === 'failing' ? failingSince ?? pr.updatedAt : null, failing };
}

export function mapIssue(repo: string, n: IssueNode): IssueItem {
  return {
    repository: repo,
    number: n.number,
    kind: 'issue',
    title: n.title,
    url: n.url,
    labels: (n.labels?.nodes ?? []).map((l) => l.name),
    assignees: n.assignees.nodes.filter((a): a is { login: string } => !!a).map((a) => a.login),
    created: n.createdAt,
    last_activity: n.updatedAt,
    milestone: n.milestone?.title ?? null,
    linked_open_pull_request: null,
  };
}

export function mapPullRequest(repo: string, n: PullRequestNode): PullRequestItem {
  const requested = (n.reviewRequests?.nodes ?? []).map((r) => reviewerName(r.requestedReviewer)).filter((x): x is string => !!x);
  const reviews = (n.latestReviews?.nodes ?? []).filter((r) => r.state !== 'PENDING' && r.submittedAt);
  const changes = reviews.filter((r) => r.state === 'CHANGES_REQUESTED').sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const events = n.timelineItems?.nodes ?? [];
  const requestTimes = events
    .filter((e) => e.__typename === 'ReviewRequestedEvent')
    .map((e) => e as Extract<typeof e, { __typename: 'ReviewRequestedEvent' }>)
    .filter((e) => requested.length === 0 || requested.includes(reviewerName(e.requestedReviewer) ?? ''))
    .map((e) => e.createdAt)
    .sort();
  const ready = events.filter((e) => e.__typename === 'ReadyForReviewEvent').map((e) => e.createdAt ?? '').sort();
  const c = checks(n);

  let waitingSince: string | null;
  if (n.reviewDecision === 'CHANGES_REQUESTED') waitingSince = changes[0]?.submittedAt ?? n.updatedAt;
  else waitingSince = requestTimes[requestTimes.length - 1] ?? ready[ready.length - 1] ?? n.createdAt;

  return {
    repository: repo,
    number: n.number,
    kind: 'pull_request',
    title: n.title,
    url: n.url,
    labels: (n.labels?.nodes ?? []).map((l) => l.name),
    milestone: n.milestone?.title ?? null,
    last_activity: n.updatedAt,
    created: n.createdAt,
    author: n.author?.login ?? 'ghost',
    assignees: n.assignees.nodes.filter((a): a is { login: string } => !!a).map((a) => a.login),
    draft: n.isDraft,
    review_decision: n.reviewDecision ?? null,
    reviewed: reviews.length > 0,
    requested_reviewers: requested,
    changes_requested_by: changes[0]?.author?.login ?? null,
    checks: c.state,
    checks_failing_since: c.failingSince,
    failing_check_count: c.failing,
    waiting_since: waitingSince,
    files_changed: n.changedFiles,
  };
}

/** Mark each issue that an open pull request in the same repository will close. */
export function linkIssues(repo: string, issues: IssueItem[], prs: PullRequestNode[]): void {
  const byNumber = new Map(issues.map((i) => [i.number, i]));
  for (const pr of prs) {
    for (const ref of pr.closingIssuesReferences?.nodes ?? []) {
      if (ref.repository.nameWithOwner.toLowerCase() !== repo.toLowerCase()) continue;
      const issue = byNumber.get(ref.number);
      if (issue && issue.linked_open_pull_request == null) issue.linked_open_pull_request = pr.number;
    }
  }
}
