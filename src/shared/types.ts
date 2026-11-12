// The domain model the rules engine reads. Field names follow design/sample-data.json so the
// fixture loads without translation. Dates are ISO strings: either a calendar date
// ("2026-11-05") or a full timestamp ("2026-11-05T09:12:00Z").

export type Stage = 'backlog' | 'in_progress' | 'needs_review' | 'open_pull_requests';
export const STAGES: readonly Stage[] = ['backlog', 'in_progress', 'needs_review', 'open_pull_requests'];

export type Bucket = 'blocked' | 'needs_your_decision' | 'on_track';

export type ReviewDecision = 'REVIEW_REQUIRED' | 'APPROVED' | 'CHANGES_REQUESTED' | null;
export type ChecksState = 'passing' | 'failing' | 'pending' | 'none';

export type InProgressRule = 'linked_pull_request' | 'assigned' | 'label' | 'project_column';

export interface Settings {
  review_target_days: number;
  stalled_after_days: number;
  failing_checks_block_after_days: number;
  pace_window_days: number;
  in_progress_rule: InProgressRule;
  /** Used only when in_progress_rule is "label". */
  in_progress_label?: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  review_target_days: 2,
  stalled_after_days: 5,
  failing_checks_block_after_days: 1,
  pace_window_days: 14,
  in_progress_rule: 'linked_pull_request',
  in_progress_label: null,
};

export interface BaseItem {
  repository: string; // owner/name
  number: number;
  title: string;
  /** Link to the item on GitHub. Null for sample data, which has no GitHub page. */
  url?: string | null;
  labels: string[];
  milestone: string | null;
  last_activity: string;
}

export interface IssueItem extends BaseItem {
  kind: 'issue';
  assignees: string[];
  created: string;
  linked_open_pull_request: number | null;
  /** Project column, for the "project column" in-progress rule. */
  project_column?: string | null;
}

export interface PullRequestItem extends BaseItem {
  kind: 'pull_request';
  author: string;
  draft: boolean;
  review_decision: ReviewDecision;
  /** True once any review has been submitted. Used only when review_decision is null. */
  reviewed?: boolean;
  requested_reviewers: string[];
  changes_requested_by: string | null;
  checks: ChecksState;
  checks_failing_since: string | null;
  failing_check_count?: number;
  waiting_since: string | null;
  created?: string;
  files_changed?: number;
  assignees?: string[];
}

export type Item = IssueItem | PullRequestItem;

export interface Milestone {
  title: string;
  due: string | null;
  open: number;
  closed: number;
  /** Items in the milestone closed within the last N days, keyed by N. */
  closed_in_window: Record<number, number>;
  url?: string | null;
}

export interface Repository {
  full_name: string;
  owner: string;
  name: string;
  url?: string | null;
  /** Backlog issues counted but not listed individually (sample data only). */
  unlisted_backlog_issues: number;
  milestones: Milestone[];
  last_synced_at?: string | null;
  sync_state?: 'pending' | 'ok' | 'error';
  sync_error?: string | null;
}

export interface Dataset {
  /** The day the rules are evaluated on, as a calendar date. */
  today: string;
  /** The current moment, used for "4 hours ago". Defaults to the start of today. */
  now?: string;
  viewer: string;
  settings: Settings;
  repositories: Repository[];
  items: Item[];
}
