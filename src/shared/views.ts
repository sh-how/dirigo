// View models for each screen, built from the rules engine's analysis. Every sentence a
// screen shows is generated here, so all screens agree. Pure and serialisable.

import { ago, age, dayMonth, days, daysBetween, longDate, plural, shortDayMonth, addDays, toTime } from './dates.js';
import {
  ANY_REVIEWER, type Analysis, type Classified, type Projection, type RepositoryStatus, type RepositorySummary,
  type MilestoneStatus, analyse, compareCards, compareWaiting,
} from './rules.js';
import type { Bucket, Dataset, Item, Stage } from './types.js';
import { STAGES } from './types.js';
import { Word, capitalise, joinNames, pick, word } from './words.js';

export type Tone = 'blocked' | 'waiting' | 'ok' | 'neutral';

export interface Link {
  label: string;
  url: string | null;
  primary?: boolean;
}

export interface TextPart {
  text: string;
  strong?: boolean;
  tone?: Tone;
}

// ---- Shared helpers ------------------------------------------------------------------------

export const STAGE_TITLES: Record<Stage, string> = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  needs_review: 'Needs review',
  open_pull_requests: 'Open pull requests',
};

export const STAGE_DESCRIPTIONS: Record<Stage, string> = {
  backlog: 'Open issues, not started',
  in_progress: 'Someone is working on it',
  needs_review: 'Waiting on a reviewer',
  open_pull_requests: 'Drafts, revisions, ready to merge',
};

export const EMPTY_CELL: Record<Stage, string> = {
  backlog: 'No open issues',
  in_progress: 'Nothing in progress',
  needs_review: 'Nothing waiting',
  open_pull_requests: 'No open pull requests',
};

const STAGE_SHORT: Record<Stage, string> = {
  backlog: 'backlog',
  in_progress: 'in progress',
  needs_review: 'review',
  open_pull_requests: 'pull request',
};

const REPO_STATUS_LABEL: Record<RepositoryStatus, string> = {
  behind: 'Behind',
  at_risk: 'At risk',
  on_track: 'On track',
};

export function statusTone(s: RepositoryStatus | MilestoneStatus): Tone {
  return s === 'on_track' ? 'ok' : 'blocked';
}

function person(name: string, ds: Dataset, capital = false): string {
  if (name === ds.viewer) return capital ? 'You' : 'you';
  if (name === ANY_REVIEWER) return capital ? 'Any reviewer' : 'any reviewer';
  return name;
}

function people(names: string[], ds: Dataset, capital = false): string {
  return joinNames(names.map((n, i) => person(n, ds, capital && i === 0)));
}

function kindName(item: Item): string {
  return item.kind === 'issue' ? 'issue' : 'pull request';
}

function repoName(item: Item): string {
  return item.repository.split('/')[1] ?? item.repository;
}

function checksUrl(item: Item): string | null {
  return item.url ? `${item.url}/checks` : null;
}

function filesText(item: Item): string | null {
  return item.kind === 'pull_request' && item.files_changed != null ? plural(item.files_changed, 'file') : null;
}

function checksText(item: Item): string | null {
  if (item.kind !== 'pull_request') return null;
  switch (item.checks) {
    case 'passing': return 'checks pass';
    case 'failing': return item.failing_check_count ? `${plural(item.failing_check_count, 'check')} failing` : 'checks failing';
    case 'pending': return 'checks running';
    default: return null;
  }
}

function failingChecksLabel(item: Item): string {
  const n = item.kind === 'pull_request' ? item.failing_check_count : 0;
  return n ? `See the ${n} failing ${pick(n, 'check', 'checks')}` : 'See the failing checks';
}

/** The plain-language problem headline for a blocked item. */
export function problemHeadline(c: Classified): string {
  const n = c.blocked_days ?? 0;
  switch (c.block_reason) {
    case 'stalled_review': return `A review has stalled for ${days(n)}`;
    case 'checks_failing': return 'Checks are failing on a release pull request';
    case 'stalled_revision': return `A requested revision has stalled for ${days(n)}`;
    case 'stalled_work': return `Work has stalled for ${days(n)}`;
    case 'stalled_pull_request': return `A pull request has stalled for ${days(n)}`;
    default: return 'Blocked';
  }
}

function waitingOnFact(c: Classified, ds: Dataset): string {
  const names = c.waiting_on;
  if (names.length === 0) return 'Nobody';
  switch (c.wait_reason) {
    case 'review':
      return names[0] === ANY_REVIEWER ? 'Any reviewer' : `${people(names, ds, true)}, ${pick(names.length, 'reviewer', 'reviewers')}`;
    case 'changes_requested':
    case 'checks_failing':
      return `${person(names[0], ds, true)}, the author`;
    case 'in_progress':
      return `${people(names, ds, true)}, ${pick(names.length, 'assignee', 'assignees')}`;
    default:
      return people(names, ds, true);
  }
}

function owner(item: Item, ds: Dataset): string | null {
  const a = item.kind === 'issue' ? item.assignees : item.assignees ?? [];
  if (!a.length) return null;
  return a.length === 1 ? person(a[0], ds) : `${person(a[0], ds)} +${a.length - 1}`;
}

// ---- Milestone copy -----------------------------------------------------------------------

export interface MilestoneSummary {
  title: string;
  due: string;
  /** "v0.9 · due 21 November · 10 days left" */
  line: string;
  /** "due 21 November · 10 days left" */
  due_line: string;
  percent: number;
  status: MilestoneStatus;
  /** "5 days late", "At risk", "On track" */
  status_text: string;
  /** "5 days late", "2 days early", "At risk, no days to spare" */
  difference_text: string;
  strong: string; // "62% done."
  summary: string; // "15 items left, at this pace it lands 26 November."
}

function daysLeftText(n: number): string {
  if (n > 0) return `${days(n)} left`;
  if (n === 0) return 'due today';
  return `${days(-n)} overdue`;
}

function itemRef(c: Classified): string {
  return `${kindName(c.item)} ${c.item.number}`;
}

export function differenceText(p: Projection): string {
  if (p.landing === null) return 'No recent progress';
  const d = p.difference_days ?? 0;
  if (d < 0) return `${days(-d)} late`;
  if (p.status === 'at_risk') return d === 0 ? 'At risk, no days to spare' : `At risk, ${days(d)} to spare`;
  if (d === 0) return 'Lands on the due date';
  return `${days(d)} early`;
}

export function milestoneSummary(p: Projection, ds: Dataset): MilestoneSummary {
  const m = p.milestone;
  const dueLine = `due ${dayMonth(p.due)} · ${daysLeftText(p.days_left)}`;
  const left = plural(m.open, 'item');
  let summary: string;
  if (p.landing === null) summary = `No progress in the last ${days(ds.settings.pace_window_days)}.`;
  else if (p.status === 'late') summary = `${left} left, at this pace it lands ${dayMonth(p.landing)}.`;
  else if (p.status === 'at_risk' && p.blocked.length > 0) {
    const b = p.blocked[0];
    summary = `On pace only if ${itemRef(b)} ${b.item.kind === 'pull_request' ? 'merges' : 'is closed'} this week.`;
  } else if (p.status === 'at_risk') summary = `${left} left, with no days to spare.`;
  else summary = `${left} left.`;
  let statusText: string;
  if (p.status === 'late') statusText = p.landing === null ? 'No recent progress' : `${days(-(p.difference_days ?? 0))} late`;
  else statusText = p.status === 'at_risk' ? 'At risk' : 'On track';
  return {
    title: m.title,
    due: p.due,
    line: `${m.title} · ${dueLine}`,
    due_line: dueLine,
    percent: p.percent_done,
    status: p.status,
    status_text: statusText,
    difference_text: differenceText(p),
    strong: `${p.percent_done}% done.`,
    summary,
  };
}

// ---- Sidebar and account -------------------------------------------------------------------

export interface ShellInfo {
  reviews_badge: number;
}

export function shellInfo(a: Analysis): ShellInfo {
  return { reviews_badge: a.waiting_on_you.length };
}

// ---- Today ---------------------------------------------------------------------------------

export interface BucketTab {
  key: Bucket;
  count: number;
  label: string;
  caption: string;
  emphasised: boolean;
}

export interface BlockedCard {
  key: string;
  problem: string;
  item_line: string;
  repository: { name: string; full_name: string };
  facts: { label: string; value: string }[];
  links: Link[];
}

export interface DecisionRow {
  key: string;
  title: string;
  repository: { name: string; full_name: string };
  context: TextPart[];
  link: Link;
}

export interface ShipBlock {
  repository: { name: string; full_name: string };
  status: RepositoryStatus;
  tone: Tone;
  label: string;
  milestone: MilestoneSummary | null;
}

export interface TodayView {
  date_line: string;
  state: 'normal' | 'nothing_blocked' | 'no_repositories' | 'syncing';
  headline: string;
  lead: string;
  buckets: BucketTab[];
  blocked: BlockedCard[];
  decisions: DecisionRow[];
  on_track_count: number;
  ship: ShipBlock[];
}

function blockedCard(c: Classified, ds: Dataset): BlockedCard {
  const facts: { label: string; value: string }[] = [];
  if (c.milestone?.due) facts.push({ label: 'Holds up', value: `${c.milestone.title}, due ${dayMonth(c.milestone.due)}` });
  facts.push({ label: 'Waiting on', value: waitingOnFact(c, ds) });
  if (c.blocked_since) {
    facts.push({ label: c.block_reason === 'checks_failing' ? 'Failing since' : 'Stalled since', value: longDate(c.blocked_since) });
  }
  const links: Link[] = c.block_reason === 'checks_failing'
    ? [{ label: failingChecksLabel(c.item), url: checksUrl(c.item), primary: true }, { label: 'Open on GitHub', url: c.item.url ?? null }]
    : [{ label: 'Open on GitHub', url: c.item.url ?? null, primary: true }];
  return {
    key: c.key,
    problem: problemHeadline(c),
    item_line: `${c.item.title} · ${itemRef(c)}`,
    repository: { name: repoName(c.item), full_name: c.item.repository },
    facts,
    links,
  };
}

function decisionRow(c: Classified, ds: Dataset): DecisionRow {
  const when = c.waiting_since ? ago(c.waiting_since, ds.today, ds.now) : '';
  const late = c.wait_reason === 'review' && c.past_review_target;
  let context: TextPart[];
  let action: string;
  let url = c.item.url ?? null;
  if (c.wait_reason === 'review') {
    context = [{ text: `${repoName(c.item)} · ${itemRef(c)} · your review was requested ` }, { text: when, strong: late, tone: late ? 'waiting' : undefined }];
    action = 'Review';
  } else if (c.wait_reason === 'changes_requested') {
    context = [{ text: `${repoName(c.item)} · your ${itemRef(c)} · changes were requested ${when}` }];
    action = 'Revise';
  } else {
    context = [{ text: `${repoName(c.item)} · your ${itemRef(c)} · checks have been failing since ${when}` }];
    action = failingChecksLabel(c.item);
    url = checksUrl(c.item);
  }
  return {
    key: c.key,
    title: c.item.title,
    repository: { name: repoName(c.item), full_name: c.item.repository },
    context,
    link: { label: action, url },
  };
}

export function buildToday(a: Analysis): TodayView {
  const ds = a.dataset;
  const date_line = longDate(ds.today);
  const nRepos = ds.repositories.length;
  const { blocked: b, needs_your_decision: w, on_track: o } = a.buckets;

  if (nRepos === 0) {
    return {
      date_line, state: 'no_repositories', headline: 'You are not watching any repositories yet.',
      lead: 'Choose the ones you answer for. Dirigo will read their issues and pull requests and fill this page in about a minute.',
      buckets: [], blocked: [], decisions: [], on_track_count: 0, ship: [],
    };
  }

  let headline: string;
  let lead: string;
  const others = `The other ${word(o)} ${pick(o, 'is', 'are')} moving without you.`;
  if (b > 0) {
    headline = `${Word(b)} ${pick(b, 'thing is', 'things are')} blocking delivery.`;
    lead = (w > 0 ? `${Word(w)} more ${pick(w, 'is', 'are')} waiting on a decision from you. ` : 'Nothing is waiting on you. ') + others;
  } else if (w > 0) {
    headline = `${Word(w)} ${pick(w, 'thing needs', 'things need')} your decision.`;
    lead = `Nothing is blocked. ${others}`;
  } else {
    headline = 'Nothing is blocked. Nothing is waiting on you.';
    const behind = a.repositories.filter((r) => r.status !== 'on_track').length;
    if (behind === 0) {
      lead = nRepos === 1
        ? 'Your repository is on track. You do not need to do anything here today.'
        : `All ${word(nRepos)} repositories are on track. You do not need to do anything here today.`;
    } else {
      lead = `${Word(behind)} of your ${word(nRepos)} ${pick(nRepos, 'repository', 'repositories')} ${pick(behind, 'is', 'are')} behind at the current pace. Nothing needs your decision today.`;
    }
  }
  const state: TodayView['state'] = b === 0 && w === 0 ? 'nothing_blocked' : 'normal';
  const emphasised: Bucket = b > 0 ? 'blocked' : w > 0 ? 'needs_your_decision' : 'on_track';

  const buckets: BucketTab[] = [
    { key: 'blocked', count: b, label: 'Blocked', caption: b > 0 ? 'holding up a milestone' : 'nothing is holding up a milestone', emphasised: emphasised === 'blocked' },
    { key: 'needs_your_decision', count: w, label: 'Needs your decision', caption: w > 0 ? 'waiting on you' : 'no reviews or changes waiting on you', emphasised: emphasised === 'needs_your_decision' },
    { key: 'on_track', count: o, label: 'On track', caption: 'moving without you', emphasised: emphasised === 'on_track' },
  ];

  const ship: ShipBlock[] = a.repositories.map((r) => {
    const ms = r.next_milestone ? milestoneSummary(r.next_milestone, ds) : null;
    return {
      repository: { name: r.repository.name, full_name: r.repository.full_name },
      status: r.status,
      tone: statusTone(r.status),
      label: state === 'nothing_blocked' && ms ? (r.status === 'on_track' ? ms.difference_text : REPO_STATUS_LABEL[r.status]) : REPO_STATUS_LABEL[r.status],
      milestone: ms,
    };
  });

  return {
    date_line, state, headline, lead, buckets,
    blocked: a.blocked.map((c) => blockedCard(c, ds)),
    decisions: a.waiting_on_you.map((c) => decisionRow(c, ds)),
    on_track_count: o,
    ship,
  };
}

// ---- Work cards (All work and One repository) ----------------------------------------------

export type CardVariant = 'plain' | 'blocked' | 'waiting' | 'ready';

export interface WorkCard {
  key: string;
  number: number;
  title: string;
  url: string | null;
  repository: { name: string; full_name: string };
  variant: CardVariant;
  /** Label above the title on screen 5, e.g. "Blocked for 6 days". */
  label: string | null;
  /** Line under the title on screen 5. */
  meta: TextPart[];
  /** Label and line used on the single-repository board (screen 7). */
  board_label: string | null;
  /** "Issue 407" or "Pull request 1214", shown on its own on the board. */
  board_ref: string;
  /** The item's GitHub labels, shown as neutral tags on the board. */
  board_tags: string[];
  board_meta: TextPart[];
}

function blockedLabel(c: Classified, board: boolean): string {
  if (c.block_reason === 'checks_failing') {
    const n = c.item.kind === 'pull_request' ? c.item.failing_check_count ?? 0 : 0;
    const what = n ? `${plural(n, 'check')} failing` : 'checks failing';
    return board ? `Blocked · ${what}` : `Blocked · ${what}`;
  }
  return `Blocked for ${days(c.blocked_days ?? 0)}`;
}

function waitingLabel(c: Classified, board: boolean): string {
  if (c.wait_reason === 'changes_requested') return 'Waiting on you · changes requested';
  if (c.wait_reason === 'checks_failing') return 'Waiting on you · checks failing';
  const d = days(c.wait_days ?? 0);
  return board ? `Waiting on you for ${d}` : `Waiting on you · ${d}`;
}

function byLine(item: Item, ds: Dataset): string {
  if (item.kind !== 'pull_request') return '';
  return item.author === ds.viewer ? (item.draft ? 'your draft' : 'yours') : `by ${item.author}`;
}

/** " · No owner yet" in bold so a missing owner stands out, or " · M. Tanaka". */
function ownerParts(who: string | null): TextPart[] {
  return who ? [{ text: ` · ${capitalise(who)}` }] : [{ text: ' · ' }, { text: 'No owner yet', strong: true }];
}

export function workCard(c: Classified, ds: Dataset): WorkCard {
  const it = c.item;
  const n = String(it.number);
  const ref = `${capitalise(kindName(it))} ${n}`;
  let variant: CardVariant = 'plain';
  let label: string | null = null;
  let boardLabel: string | null = null;
  let meta: TextPart[];
  let board: TextPart[];

  if (c.blocked) {
    variant = 'blocked';
    label = blockedLabel(c, false);
    boardLabel = blockedLabel(c, true);
    const parts = [n];
    if (it.kind === 'pull_request') parts.push(byLine(it, ds));
    if (c.waiting_on.length && !(c.wait_reason !== 'review' && c.waiting_on[0] === ds.viewer)) parts.push(`waiting on ${people(c.waiting_on, ds)}`);
    if (c.milestone) parts.push(`holds up ${c.milestone.title}`);
    meta = [{ text: parts.join(' · ') }];
    board = c.waiting_on.length ? [{ text: `Waiting on ${people(c.waiting_on, ds)}` }] : [];
  } else if (c.waiting_on_you) {
    variant = 'waiting';
    label = waitingLabel(c, false);
    boardLabel = waitingLabel(c, true);
    if (c.wait_reason === 'changes_requested' && it.kind === 'pull_request') {
      meta = [{ text: `${n} · yours${it.changes_requested_by ? ` · reviewed by ${person(it.changes_requested_by, ds)}` : ''}` }];
    } else {
      meta = [{ text: `${n} · ${byLine(it, ds)}` }];
    }
    board = [{ text: capitalise(byLine(it, ds)) }];
  } else if (it.kind === 'issue') {
    const who = owner(it, ds);
    if (c.stage === 'backlog') {
      meta = [{ text: `${n} · ${age(it.created, ds.today, ds.now)} · ` }, who ? { text: who } : { text: 'no owner', strong: true }];
      board = [{ text: `Opened ${ago(it.created, ds.today, ds.now)}` }, ...ownerParts(who)];
    } else {
      const upd = `updated ${ago(it.last_activity, ds.today, ds.now)}`;
      meta = [{ text: `${n} · ${who ?? 'no owner'} · ${upd}` }];
      board = who ? [{ text: `${capitalise(who)} · ${upd}` }] : [{ text: 'No owner', strong: true }, { text: ` · ${upd}` }];
    }
  } else {
    const author = person(it.author, ds);
    if (c.ready_to_merge) {
      variant = 'ready';
      meta = [{ text: `${n} · ready to merge`, strong: true, tone: 'ok' }];
      board = [{ text: 'Approved, ready to merge', strong: true, tone: 'ok' }];
    } else if (c.stage === 'needs_review') {
      const who = it.author === ds.viewer ? 'yours' : `by ${author}`;
      meta = [{ text: `${n} · ${who} · with ${people(c.waiting_on, ds)} for ${days(c.wait_days ?? 0)}` }];
      board = [{ text: `${capitalise(who)} · waiting on ${people(c.waiting_on, ds)} for ${days(c.wait_days ?? 0)}` }];
    } else {
      const state = c.pr_state === 'draft' ? 'draft'
        : c.pr_state === 'changes_requested' ? 'changes requested'
        : c.pr_state === 'checks_failing' ? 'checks failing'
        : c.pr_state === 'approved' ? 'approved, checks pending'
        : 'open';
      const who = it.author === ds.viewer ? 'yours' : author;
      meta = [{ text: `${n} · ${who} · ${state}` }];
      const chk = checksText(it);
      board = [{ text: `${capitalise(who)} · ${state}${chk && c.pr_state === 'changes_requested' ? ` · ${chk}` : ''}` }];
    }
  }

  return {
    key: c.key, number: it.number, title: it.title, url: it.url ?? null,
    repository: { name: repoName(it), full_name: it.repository },
    variant, label, meta, board_label: boardLabel, board_meta: board,
    board_ref: ref, board_tags: it.kind === 'issue' ? it.labels.map(capitalise) : [],
  };
}

// ---- All work ------------------------------------------------------------------------------

export type QuickFilter = 'everything' | 'blocked' | 'waiting' | 'no_owner';
export type RowGrouping = 'repository' | 'person' | 'milestone' | 'none';

export interface WorkQuery {
  filter?: QuickFilter;
  person?: string | null; // a name, "me", or null for everyone
  label?: string | null;
  rows?: RowGrouping;
}

export interface WorkCell {
  stage: Stage;
  cards: WorkCard[];
  /** Items counted in this cell that are not listed individually. */
  unlisted: number;
  empty_text: string;
}

export interface WorkRow {
  key: string;
  title: string;
  subtitle: string | null;
  tone: Tone | null;
  open: number;
  /** Link to the single-repository page, when the row is a repository. */
  repository: string | null;
  cells: WorkCell[];
}

export interface WorkColumn {
  stage: Stage;
  title: string;
  description: string;
  count: number;
}

export interface WorkView {
  lead: string;
  repositories: number;
  filters: { key: QuickFilter; label: string; count: number }[];
  people: { value: string; label: string }[];
  labels: { value: string; label: string }[];
  query: Required<WorkQuery>;
  columns: WorkColumn[];
  rows: WorkRow[];
  empty_columns: { title: string; body: string } | null;
}

function involves(c: Classified, name: string): boolean {
  const it = c.item;
  if (it.kind === 'issue') return it.assignees.includes(name);
  return it.author === name || it.requested_reviewers.includes(name) || (it.assignees ?? []).includes(name);
}

function workLead(a: Analysis): string {
  const n = a.open_items;
  const repos = a.dataset.repositories.length;
  const head = `${plural(n, 'open item')} across ${plural(repos, 'repository', 'repositories')}.`;
  if (n === 0) return `Nothing is open across ${plural(repos, 'repository', 'repositories')}.`;
  const ready = a.items.filter((c) => c.ready_to_merge).length;
  if (ready === n) {
    return `${head} ${n === 1 ? 'It is a pull request' : n === 2 ? 'Both are pull requests' : 'All are pull requests'} ready to merge.`;
  }
  const b = a.buckets.blocked;
  const o = a.no_owner;
  if (b === 0 && o === 0) return `${head} Nothing is blocked and every issue has an owner.`;
  const parts: string[] = [];
  if (b > 0) parts.push(`${b} ${pick(b, 'is', 'are')} blocked`);
  if (o > 0) parts.push(`${o} ${pick(o, 'has', 'have')} no owner`);
  return `${head} ${capitalise(parts.join(' and '))}.`;
}

export function buildWork(a: Analysis, q: WorkQuery = {}): WorkView {
  const ds = a.dataset;
  const query: Required<WorkQuery> = {
    filter: q.filter ?? 'everything',
    person: q.person ?? null,
    label: q.label ?? null,
    rows: q.rows ?? 'repository',
  };
  const personName = query.person === 'me' ? ds.viewer : query.person;
  const narrowed = a.items.filter((c) =>
    (!personName || involves(c, personName)) &&
    (!query.label || c.item.labels.some((l) => l.toLowerCase() === query.label!.toLowerCase())));
  // Unlisted sample issues have no known people or labels, so they drop out of narrowed views.
  const includeUnlisted = !personName && !query.label;

  const filters: WorkView['filters'] = [
    { key: 'everything', label: 'Everything', count: narrowed.length + (includeUnlisted ? ds.repositories.reduce((n, r) => n + r.unlisted_backlog_issues, 0) : 0) },
    { key: 'blocked', label: 'Blocked', count: narrowed.filter((c) => c.blocked).length },
    { key: 'waiting', label: 'Waiting on me', count: narrowed.filter((c) => c.bucket === 'needs_your_decision').length },
    { key: 'no_owner', label: 'No owner', count: narrowed.filter((c) => c.no_owner).length },
  ];
  const matches = (c: Classified) =>
    query.filter === 'blocked' ? c.blocked
      : query.filter === 'waiting' ? c.bucket === 'needs_your_decision'
      : query.filter === 'no_owner' ? c.no_owner
      : true;
  const shown = narrowed.filter(matches);
  const unlistedOn = includeUnlisted && query.filter === 'everything';

  type Group = { key: string; title: string; subtitle: string | null; tone: Tone | null; repository: string | null; items: Classified[]; unlisted: number; order: number };
  const groups: Group[] = [];
  if (query.rows === 'repository') {
    a.repositories.forEach((r, i) => groups.push({
      key: r.repository.full_name, title: r.repository.name, subtitle: null, tone: statusTone(r.status),
      repository: r.repository.full_name, items: shown.filter((c) => c.item.repository === r.repository.full_name),
      unlisted: unlistedOn ? r.repository.unlisted_backlog_issues : 0, order: i,
    }));
  } else if (query.rows === 'person') {
    const map = new Map<string, Classified[]>();
    for (const c of shown) {
      const it = c.item;
      const who = it.kind === 'issue' ? it.assignees[0] ?? '' : it.author;
      map.set(who, [...(map.get(who) ?? []), c]);
    }
    const names = [...map.keys()].sort((x, y) => (x === ds.viewer ? -1 : y === ds.viewer ? 1 : x === '' ? 1 : y === '' ? -1 : x.localeCompare(y)));
    names.forEach((n, i) => {
      const items = map.get(n)!;
      groups.push({ key: `person:${n}`, title: n === '' ? 'No owner' : person(n, ds, true), subtitle: null,
        tone: items.some((c) => c.blocked) ? 'blocked' : null, repository: null, items, unlisted: 0, order: i });
    });
    if (unlistedOn) {
      const total = ds.repositories.reduce((s, r) => s + r.unlisted_backlog_issues, 0);
      if (total) groups.push({ key: 'person:unlisted', title: 'Others', subtitle: 'People not listed in the sample', tone: null, repository: null, items: [], unlisted: total, order: 999 });
    }
  } else if (query.rows === 'milestone') {
    const projections = new Map(a.milestones.map((p) => [`${p.repository}|${p.milestone.title}`, p]));
    const map = new Map<string, Classified[]>();
    for (const c of shown) {
      const k = c.item.milestone ? `${c.item.repository}|${c.item.milestone}` : '';
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    const keys = [...map.keys()];
    if (unlistedOn && !keys.includes('')) keys.push('');
    keys.sort((x, y) => {
      if (x === '') return 1;
      if (y === '') return -1;
      const px = projections.get(x);
      const py = projections.get(y);
      return (px?.due ?? '9999').localeCompare(py?.due ?? '9999');
    });
    keys.forEach((k, i) => {
      const p = projections.get(k);
      const [repo, title] = k.split('|');
      groups.push({
        key: `milestone:${k}`, title: k === '' ? 'No milestone' : title,
        subtitle: k === '' ? null : repo.split('/')[1] ?? repo,
        tone: p ? statusTone(p.status) : null, repository: null, items: map.get(k) ?? [],
        unlisted: k === '' && unlistedOn ? ds.repositories.reduce((s, r) => s + r.unlisted_backlog_issues, 0) : 0, order: i,
      });
    });
  } else {
    groups.push({ key: 'all', title: 'Everything', subtitle: null, tone: null, repository: null, items: shown,
      unlisted: unlistedOn ? ds.repositories.reduce((s, r) => s + r.unlisted_backlog_issues, 0) : 0, order: 0 });
  }

  const rows: WorkRow[] = groups.map((g) => ({
    key: g.key,
    title: g.title,
    subtitle: g.subtitle,
    tone: g.tone,
    open: g.items.length + g.unlisted,
    repository: g.repository,
    cells: STAGES.map((s) => ({
      stage: s,
      cards: g.items.filter((c) => c.stage === s).sort(compareCards).map((c) => workCard(c, ds)),
      unlisted: s === 'backlog' ? g.unlisted : 0,
      empty_text: EMPTY_CELL[s],
    })),
  }));

  const columns: WorkColumn[] = STAGES.map((s) => ({
    stage: s,
    title: STAGE_TITLES[s],
    description: STAGE_DESCRIPTIONS[s],
    count: rows.reduce((n, r) => n + r.cells.find((c) => c.stage === s)!.cards.length + (s === 'backlog' ? r.cells[0].unlisted : 0), 0),
  }));

  const emptyStages = STAGES.filter((s) => a.stage_counts[s] === 0);
  let empty_columns: WorkView['empty_columns'] = null;
  if (emptyStages.length === STAGES.length) {
    empty_columns = { title: 'Every column is empty.', body: 'New issues and pull requests appear here as soon as they are opened on GitHub. Dirigo checks every few minutes.' };
  } else if (emptyStages.length > 0) {
    const names = emptyStages.map((s) => STAGE_SHORT[s]);
    empty_columns = {
      title: `The ${joinNames(names)} ${pick(names.length, 'column is', 'columns are')} empty.`,
      body: 'New issues and pull requests appear here as soon as they are opened on GitHub. Dirigo checks every few minutes.',
    };
  }

  const everyone = new Set<string>();
  const labels = new Set<string>();
  for (const c of a.items) {
    const it = c.item;
    if (it.kind === 'issue') it.assignees.forEach((n) => everyone.add(n));
    else { everyone.add(it.author); it.requested_reviewers.forEach((n) => everyone.add(n)); }
    it.labels.forEach((l) => labels.add(l.toLowerCase()));
  }
  everyone.delete(ds.viewer);
  everyone.delete(ANY_REVIEWER);

  return {
    lead: workLead(a),
    repositories: ds.repositories.length,
    filters,
    people: [{ value: '', label: 'Everyone' }, { value: 'me', label: 'Me' }, ...[...everyone].sort().map((n) => ({ value: n, label: n }))],
    labels: [{ value: '', label: 'Any label' }, ...[...labels].sort().map((l) => ({ value: l, label: capitalise(l) }))],
    query,
    columns,
    rows,
    empty_columns,
  };
}

// ---- Repositories --------------------------------------------------------------------------

export interface RepositoryRow {
  full_name: string;
  name: string;
  owner: string;
  status: RepositoryStatus;
  tone: Tone;
  reason: string;
  reason_tone: Tone;
  counts: Record<Stage, number>;
  stuck_stage: Stage | null;
  milestone: { label: string; status_text: string; tone: Tone; percent: number } | null;
}

export interface RepositoriesView {
  headline: string;
  lead: string;
  rows: RepositoryRow[];
  totals: Record<Stage, number>;
  total_open: number;
  totals_label: string;
}

export function buildRepositories(a: Analysis): RepositoriesView {
  const n = a.repositories.length;
  const attention = a.repositories.filter((r) => r.status !== 'on_track').length;
  let lead: string;
  if (n === 0) lead = 'You are not watching any repositories yet.';
  else if (attention === 0) lead = n === 1 ? 'It is on track.' : `All ${word(n)} are on track.`;
  else if (attention === n) lead = n === 1 ? 'It needs attention.' : `All ${word(n)} need attention. The worst is listed first.`;
  else lead = `${Word(attention)} of your ${word(n)} ${pick(attention, 'needs', 'need')} attention. ${pick(attention, 'It is', 'They are')} listed first.`;
  const rows = a.repositories.map((r): RepositoryRow => {
    const p = r.next_milestone;
    return {
      full_name: r.repository.full_name,
      name: r.repository.name,
      owner: r.repository.owner,
      status: r.status,
      tone: statusTone(r.status),
      reason: r.worst ? problemHeadline(r.worst) : 'Nothing is stuck',
      reason_tone: r.worst ? 'blocked' : 'neutral',
      counts: r.stage_counts,
      stuck_stage: r.stuck_stage,
      milestone: p ? {
        label: `${p.milestone.title} · due ${shortDayMonth(p.due)}`,
        status_text: milestoneSummary(p, a.dataset).status_text,
        tone: statusTone(p.status),
        percent: p.percent_done,
      } : null,
    };
  });
  return {
    headline: 'Repositories',
    lead,
    rows,
    totals: a.stage_counts,
    total_open: a.open_items,
    totals_label: n === 1 ? 'Total' : `All ${word(n)} together`,
  };
}

// ---- One repository ------------------------------------------------------------------------

export interface RepositoryView {
  full_name: string;
  name: string;
  owner: string;
  url: string | null;
  status: RepositoryStatus;
  status_label: string;
  tone: Tone;
  sentence: string;
  milestone: MilestoneSummary | null;
  filters: { key: 'everything' | 'blocked' | 'waiting'; label: string; count: number }[];
  columns: { stage: Stage; title: string; count: number; cards: WorkCard[]; unlisted: number }[];
}

function repositorySentence(r: RepositorySummary, ds: Dataset): string {
  const p = r.next_milestone;
  const after = !p ? ''
    : p.status === 'late' ? (p.landing ? ` At this pace it lands ${days(-(p.difference_days ?? 0))} late.` : ` There has been no progress in the last ${days(ds.settings.pace_window_days)}.`)
    : p.status === 'at_risk' ? ' It has no days to spare.' : '';
  if (r.worst) {
    const target = r.worst.milestone?.title ?? p?.milestone.title ?? 'the next milestone';
    const n = r.blocked.length;
    let first: string;
    if (n > 1) first = `${Word(n)} blocked items are holding up ${target}.`;
    else if (r.worst.block_reason === 'stalled_review') first = `One stalled review is holding up ${target}.`;
    else if (r.worst.block_reason === 'checks_failing') first = `Failing checks are holding up ${target}.`;
    else first = `One stalled item is holding up ${target}.`;
    return first + after;
  }
  if (!p) return 'Nothing is stuck. This repository has no milestone with a due date.';
  if (p.status === 'late') return `Nothing is stuck, but ${p.milestone.title} is behind.${after}`;
  if (p.status === 'at_risk') return `Nothing is stuck, but ${p.milestone.title} has no days to spare.`;
  return `Nothing is stuck. ${p.milestone.title} is on pace.`;
}

export function buildRepository(a: Analysis, fullName: string, filter: 'everything' | 'blocked' | 'waiting' = 'everything'): RepositoryView | null {
  const r = a.repositories.find((x) => x.repository.full_name.toLowerCase() === fullName.toLowerCase());
  if (!r) return null;
  const ds = a.dataset;
  const keep = (c: Classified) => (filter === 'blocked' ? c.blocked : filter === 'waiting' ? c.bucket === 'needs_your_decision' : true);
  const shown = r.items.filter(keep);
  return {
    full_name: r.repository.full_name,
    name: r.repository.name,
    owner: r.repository.owner,
    url: r.repository.url ?? null,
    status: r.status,
    status_label: REPO_STATUS_LABEL[r.status],
    tone: statusTone(r.status),
    sentence: repositorySentence(r, ds),
    milestone: r.next_milestone ? milestoneSummary(r.next_milestone, ds) : null,
    filters: [
      { key: 'everything', label: 'Everything', count: r.open_items },
      { key: 'blocked', label: 'Blocked', count: r.blocked.length },
      { key: 'waiting', label: 'Waiting on me', count: r.waiting_on_you.length },
    ],
    columns: STAGES.map((s) => {
      const unlisted = s === 'backlog' && filter === 'everything' ? r.repository.unlisted_backlog_issues : 0;
      const cards = shown.filter((c) => c.stage === s).sort(compareCards).map((c) => workCard(c, ds));
      return { stage: s, title: s === 'backlog' ? 'Open issues' : STAGE_TITLES[s], count: cards.length + unlisted, cards, unlisted };
    }),
  };
}

// ---- Reviews -------------------------------------------------------------------------------

export interface ReviewRow {
  key: string;
  title: string;
  url: string | null;
  context: string;
  who: string;
  who_note: string | null;
  wait_days: number;
  wait_label: string;
  past_target: boolean;
  fill: number; // 0..1 of one week
  holds_up: string | null;
  action: Link;
}

export interface ReviewsView {
  headline: string;
  lead: string;
  target_days: number;
  tick: number; // 0..1
  mine: ReviewRow[];
  others: ReviewRow[];
  load: { name: string; waiting: number; oldest_days: number; oldest_label: string; past_target: boolean }[];
}

function reviewRow(c: Classified, ds: Dataset, mine: boolean): ReviewRow {
  const it = c.item;
  const wait = c.wait_days ?? 0;
  const past = wait > ds.settings.review_target_days;
  const parts = [repoName(it), `pull request ${it.number}`];
  if (it.kind === 'pull_request') {
    if (it.author === ds.viewer) {
      parts.push('yours');
      if (c.wait_reason === 'changes_requested' && it.changes_requested_by) parts.push(`${person(it.changes_requested_by, ds, true)} asked for changes`);
      else { const f = filesText(it); if (f) parts.push(f); const ch = checksText(it); if (ch) parts.push(ch); }
    } else {
      parts.push(`by ${it.author}`);
      const f = filesText(it); if (f) parts.push(f);
      const ch = checksText(it); if (ch) parts.push(ch);
    }
  }
  let who: string;
  let note: string | null = null;
  let action: Link;
  if (mine) {
    who = c.wait_reason === 'review' ? 'Your review' : c.wait_reason === 'changes_requested' ? 'Your changes' : 'Your checks';
    action = c.wait_reason === 'review' ? { label: 'Review', url: it.url ?? null }
      : c.wait_reason === 'changes_requested' ? { label: 'Revise', url: it.url ?? null }
      : { label: 'Fix checks', url: checksUrl(it) };
  } else {
    who = people(c.waiting_on, ds, true);
    note = 'to review';
    action = { label: 'Open on GitHub', url: it.url ?? null };
  }
  return {
    key: c.key, title: it.title, url: it.url ?? null, context: parts.join(' · '), who, who_note: note,
    wait_days: wait, wait_label: days(wait), past_target: past, fill: Math.min(1, wait / 7),
    holds_up: c.blocked && c.milestone ? `Holds up ${c.milestone.title}` : null,
    action,
  };
}

export function buildReviews(a: Analysis): ReviewsView {
  const ds = a.dataset;
  const target = ds.settings.review_target_days;
  const mineItems = a.waiting_on_you;
  const otherItems = a.items.filter((c) => c.stage === 'needs_review' && !c.waiting_on_you).sort(compareWaiting);
  const mine = mineItems.map((c) => reviewRow(c, ds, true));
  if (mine[0]) mine[0].action.primary = true;
  const others = otherItems.map((c) => reviewRow(c, ds, false));

  const all = [...mineItems, ...otherItems];
  const stuck = all.filter((c) => (c.wait_days ?? 0) >= ds.settings.stalled_after_days);
  const past = all.filter((c) => (c.wait_days ?? 0) > target);
  let headline: string;
  if (all.length === 0) headline = 'No reviews are waiting.';
  else if (stuck.length > 0) {
    const worst = Math.max(...stuck.map((c) => c.wait_days ?? 0));
    headline = stuck.length === 1
      ? `One review has been stuck for ${days(worst)}.`
      : `${Word(stuck.length)} reviews have been stuck for up to ${days(worst)}.`;
  } else if (past.length > 0) {
    headline = `${Word(past.length)} ${pick(past.length, 'review is', 'reviews are')} past your ${target}-day target.`;
  } else headline = 'Every review is within your target.';

  const mineMore = mineItems.filter((c) => !stuck.includes(c) && !(stuck.length === 0 && past.includes(c))).length;
  const mineCount = stuck.length > 0 || past.length > 0 ? mineMore : mineItems.length;
  let first = '';
  if (all.length > 0) {
    if (mineCount === 0) first = 'Nothing else is waiting on you. ';
    else if (stuck.length > 0 || past.length > 0) first = `${Word(mineCount)} more ${pick(mineCount, 'is', 'are')} waiting on you. `;
    else first = `${Word(mineCount)} ${pick(mineCount, 'is', 'are')} waiting on you. `;
  }
  const lead = `${first}Your target is a first response within ${days(target)}.`;

  const load = new Map<string, { waiting: number; oldest: number }>();
  for (const c of a.items) {
    if (c.stage !== 'needs_review' || c.wait_reason !== 'review') continue;
    for (const n of c.waiting_on) {
      if (n === ANY_REVIEWER) continue;
      const cur = load.get(n) ?? { waiting: 0, oldest: 0 };
      load.set(n, { waiting: cur.waiting + 1, oldest: Math.max(cur.oldest, c.wait_days ?? 0) });
    }
  }
  const loadRows = [...load.entries()]
    .sort((x, y) => y[1].waiting - x[1].waiting || y[1].oldest - x[1].oldest || x[0].localeCompare(y[0]))
    .map(([n, v]) => ({
      name: person(n, ds, true), waiting: v.waiting, oldest_days: v.oldest,
      oldest_label: `oldest ${days(v.oldest)}`, past_target: v.oldest > target,
    }));

  return { headline, lead, target_days: target, tick: Math.min(1, target / 7), mine, others, load: loadRows };
}

// ---- Milestones ----------------------------------------------------------------------------

export interface MilestoneRow {
  key: string;
  repository: { name: string; full_name: string };
  title: string;
  status: MilestoneStatus;
  tone: Tone;
  dates: string;
  difference_text: string;
  /** Positions on the shared axis, 0..1. */
  bar_end: number;
  due_at: number;
  landing_at: number | null;
  aria: string;
  strong: string;
  note: string;
}

export interface MilestonesView {
  headline: string;
  lead: string;
  pace_window: number;
  axis: { start_label: string; marks: { label: string; at: number }[] };
  rows: MilestoneRow[];
}

function holdUpNote(p: Projection): string {
  if (p.landing === null) return 'Nothing closed recently, so there is no pace to project from.';
  const b = p.blocked[0];
  if (b) {
    if (b.block_reason === 'stalled_review') return `The review stalled on ${itemRef(b)} is the hold-up.`;
    if (b.block_reason === 'checks_failing') {
      return p.status === 'at_risk' ? `Holds only if ${itemRef(b)} passes its checks this week.` : `Failing checks on ${itemRef(b)} are the hold-up.`;
    }
    return `${capitalise(itemRef(b))} has stalled and is the hold-up.`;
  }
  if (p.status === 'late') return 'Nothing is blocked, but the pace is too slow for the due date.';
  return 'Nothing is in the way.';
}

export function buildMilestones(a: Analysis): MilestonesView {
  const ds = a.dataset;
  const ps = a.milestones;
  const late = ps.filter((p) => p.status === 'late').length;
  const risk = ps.filter((p) => p.status === 'at_risk').length;
  const ok = ps.length - late - risk;
  let headline: string;
  if (ps.length === 0) headline = 'No milestone has a due date yet.';
  else if (late === 0 && risk === 0) headline = 'Every milestone is on track.';
  else {
    const parts: string[] = [];
    if (late > 0) parts.push(`${Word(late)} ${pick(late, 'milestone', 'milestones')} will be late.`);
    if (risk > 0) parts.push(late > 0 ? `${Word(risk)} ${pick(risk, 'is', 'are')} at risk.` : `${Word(risk)} ${pick(risk, 'milestone is', 'milestones are')} at risk.`);
    headline = parts.join(' ');
  }
  let lead: string;
  if (ps.length === 0) lead = 'Add a due date to a milestone on GitHub and Dirigo will project when it lands.';
  else if (ok === 0) lead = `None will land early at the current pace.`;
  else {
    const early = ps.filter((p) => p.status === 'on_track' && (p.difference_days ?? 0) > 0).length;
    const subject = late + risk === 0 ? (ok === 1 ? 'It' : `All ${word(ok)}`) : `The other ${word(ok)}`;
    lead = `${subject} will land ${early === ok ? 'early' : 'on time'} at the current pace.`;
  }

  const start = ds.today;
  const lastDue = ps.reduce((m, p) => (p.due > m ? p.due : m), start);
  const cap = addDays(lastDue, 60);
  const lastLanding = ps.reduce((m, p) => (p.landing && p.landing > m ? (p.landing < cap ? p.landing : cap) : m), lastDue);
  const end = addDays(lastLanding > lastDue ? lastLanding : lastDue, 3);
  const span = Math.max(1, daysBetween(start, end));
  const at = (iso: string) => Math.max(0, Math.min(1, daysBetween(start, iso) / span));

  const marks: { label: string; at: number }[] = [];
  const s = new Date(toTime(start));
  let y = s.getUTCFullYear();
  let m = s.getUTCMonth() + 1;
  const months = Math.ceil(span / 30);
  const step = months > 8 ? Math.ceil(months / 6) : 1;
  for (;;) {
    if (m > 11) { y += Math.floor(m / 12); m %= 12; }
    const iso = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    if (iso >= end) break;
    const pos = at(iso);
    if (pos > 0.08) marks.push({ label: shortDayMonth(iso), at: pos });
    m += step;
  }

  const rows = ps.map((p): MilestoneRow => {
    const repo = p.repository.split('/')[1] ?? p.repository;
    const dates = p.landing ? `Due ${dayMonth(p.due)}, lands ${dayMonth(p.landing)}` : `Due ${dayMonth(p.due)}, no landing date`;
    return {
      key: `${p.repository}|${p.milestone.title}`,
      repository: { name: repo, full_name: p.repository },
      title: p.milestone.title,
      status: p.status,
      tone: statusTone(p.status),
      dates,
      difference_text: differenceText(p),
      bar_end: p.landing ? at(p.landing) : 1,
      due_at: at(p.due),
      landing_at: p.landing ? at(p.landing) : null,
      aria: p.landing ? `Due ${dayMonth(p.due)}, projected to land ${dayMonth(p.landing)}` : `Due ${dayMonth(p.due)}, no projected landing date`,
      strong: `${p.percent_done}% done, ${plural(p.milestone.open, 'item')} left.`,
      note: holdUpNote(p),
    };
  });

  return {
    headline, lead, pace_window: ds.settings.pace_window_days,
    axis: { start_label: `Today, ${shortDayMonth(start)}`, marks },
    rows,
  };
}

// ---- Convenience ---------------------------------------------------------------------------

export { analyse };
