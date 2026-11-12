import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyse } from '../src/shared/rules';
import { datasetFromFixture, type Fixture } from '../src/shared/fixture';
import {
  buildMilestones, buildRepositories, buildRepository, buildReviews, buildToday, buildWork, shellInfo,
} from '../src/shared/views';
import type { Dataset } from '../src/shared/types';

const fixture = JSON.parse(readFileSync('design/sample-data.json', 'utf8')) as Fixture;
const sample = (): Dataset => datasetFromFixture(fixture);
const text = (parts: { text: string }[]) => parts.map((p) => p.text).join('');

describe('Today', () => {
  const v = buildToday(analyse(sample()));

  it('opens with the generated sentences in the mockup', () => {
    expect(v.date_line).toBe('Wednesday 11 November');
    expect(v.headline).toBe('Two things are blocking delivery.');
    expect(v.lead).toBe('Three more are waiting on a decision from you. The other 37 are moving without you.');
    expect(v.buckets.map((b) => b.count)).toEqual([2, 3, 37]);
  });

  it('describes each blocked item', () => {
    const lattice = v.blocked.find((b) => b.repository.name === 'lattice')!;
    expect(lattice.problem).toBe('A review has stalled for 6 days');
    expect(lattice.item_line).toBe('Parallelise segment merges · pull request 479');
    expect(lattice.facts).toEqual([
      { label: 'Holds up', value: 'v0.9, due 21 November' },
      { label: 'Waiting on', value: 'M. Tanaka, reviewer' },
      { label: 'Stalled since', value: 'Thursday 5 November' },
    ]);
    const api = v.blocked.find((b) => b.repository.name === 'api')!;
    expect(api.problem).toBe('Checks are failing on a release pull request');
    expect(api.facts.map((f) => f.value)).toEqual(['November release, due 18 November', 'You, the author', 'Monday 9 November']);
    expect(api.links.map((l) => l.label)).toEqual(['See the 2 failing checks', 'Open on GitHub']);
  });

  it('lists decisions oldest first, each with an action', () => {
    expect(v.decisions.map((d) => text(d.context))).toEqual([
      'lattice · pull request 491 · your review was requested 4 days ago',
      'web-app · your pull request 744 · changes were requested 2 days ago',
      'kit · pull request 101 · your review was requested yesterday',
    ]);
    expect(v.decisions.map((d) => d.link.label)).toEqual(['Review', 'Revise', 'Review']);
  });

  it('projects each repository', () => {
    expect(v.ship.map((s) => [s.repository.name, s.label, s.milestone?.line, s.milestone?.summary])).toEqual([
      ['lattice', 'Behind', 'v0.9 · due 21 November · 10 days left', '15 items left, at this pace it lands 26 November.'],
      ['api', 'At risk', 'November release · due 18 November · 7 days left', 'On pace only if pull request 1214 merges this week.'],
      ['web-app', 'On track', 'Q4 polish · due 12 December · 31 days left', '3 items left.'],
      ['kit', 'On track', 'v2.0 · due 15 January · 65 days left', '9 items left.'],
    ]);
  });

  it('switches to the nothing-blocked state when the blocked items go', () => {
    const ds = sample();
    ds.items = ds.items.filter((i) => ![479, 1214, 491, 744, 101].includes(i.number));
    const t = buildToday(analyse(ds));
    expect(t.state).toBe('nothing_blocked');
    expect(t.headline).toBe('Nothing is blocked. Nothing is waiting on you.');
    expect(t.buckets.find((b) => b.emphasised)!.key).toBe('on_track');
  });

  it('shows the empty state with no repositories', () => {
    const ds = sample();
    ds.repositories = [];
    const t = buildToday(analyse(ds));
    expect(t.state).toBe('no_repositories');
    expect(t.headline).toBe('You are not watching any repositories yet.');
  });
});

describe('All work', () => {
  const v = buildWork(analyse(sample()));

  it('summarises and filters', () => {
    expect(v.lead).toBe('42 open items across 4 repositories. 2 are blocked and 5 have no owner.');
    expect(v.filters.map((f) => f.count)).toEqual([42, 2, 3, 5]);
    expect(v.columns.map((c) => c.count)).toEqual([23, 6, 4, 9]);
    expect(v.rows.map((r) => [r.title, r.open])).toEqual([['lattice', 16], ['api', 13], ['web-app', 7], ['kit', 6]]);
  });

  it('writes the cards as in the mockup', () => {
    const lattice = v.rows[0];
    const review = lattice.cells[2].cards;
    expect(review.map((c) => [c.variant, c.label, text(c.meta)])).toEqual([
      ['blocked', 'Blocked for 6 days', '479 · by J. Lin · waiting on M. Tanaka · holds up v0.9'],
      ['waiting', 'Waiting on you · 4 days', '491 · by J. Lin'],
    ]);
    expect(text(lattice.cells[0].cards[0].meta)).toBe('482 · 3 days · no owner');
    expect(text(lattice.cells[1].cards[1].meta)).toBe('459 · J. Lin · updated 3 days ago');
    const api = v.rows[1];
    expect(text(api.cells[2].cards[0].meta)).toBe('1210 · yours · with C. Okafor for 2 days');
    expect(api.cells[3].cards[0].label).toBe('Blocked · 2 checks failing');
    expect(text(api.cells[3].cards[0].meta)).toBe('1214 · your draft · holds up November release');
  });

  it('combines filters', () => {
    const w = buildWork(analyse(sample()), { filter: 'no_owner', label: 'bug' });
    expect(w.rows.flatMap((r) => r.cells.flatMap((c) => c.cards)).length).toBe(5);
    const me = buildWork(analyse(sample()), { person: 'me' });
    expect(me.filters[0].count).toBeGreaterThan(0);
    expect(me.rows.flatMap((r) => r.cells.flatMap((c) => c.unlisted))).toEqual(Array(16).fill(0));
  });

  it('names empty columns', () => {
    const ds = sample();
    ds.items = ds.items.filter((i) => i.number === 493 || i.number === 741);
    ds.repositories.forEach((r) => (r.unlisted_backlog_issues = 0));
    const w = buildWork(analyse(ds));
    expect(w.lead).toBe('2 open items across 4 repositories. Both are pull requests ready to merge.');
    expect(w.empty_columns!.title).toBe('The backlog, in progress and review columns are empty.');
  });
});

describe('Repositories and one repository', () => {
  const a = analyse(sample());
  it('compares repositories', () => {
    const v = buildRepositories(a);
    expect(v.lead).toBe('Two of your four need attention. They are listed first.');
    expect(v.rows.map((r) => [r.name, r.reason, r.milestone?.status_text, r.stuck_stage])).toEqual([
      ['lattice', 'A review has stalled for 6 days', '5 days late', 'needs_review'],
      ['api', 'Checks are failing on a release pull request', 'At risk', 'open_pull_requests'],
      ['web-app', 'Nothing is stuck', 'On track', null],
      ['kit', 'Nothing is stuck', 'On track', null],
    ]);
    expect(v.totals_label).toBe('All four together');
  });

  it('describes one repository', () => {
    const v = buildRepository(a, 'lattice-db/lattice')!;
    expect(v.status_label).toBe('Behind');
    expect(v.sentence.startsWith('One stalled review is holding up v0.9.')).toBe(true);
    expect(v.filters.map((f) => f.count)).toEqual([16, 1, 1]);
    expect(v.columns.map((c) => c.count)).toEqual([9, 2, 2, 3]);
    expect(v.columns[0].cards[0].board_ref).toBe('Issue 482');
    expect(v.columns[0].cards[0].board_tags).toEqual(['Bug']);
    expect(text(v.columns[0].cards[0].board_meta)).toBe('Opened 3 days ago · No owner yet');
    expect(text(v.columns[3].cards[0].board_meta)).toBe('Approved, ready to merge');
  });
});

describe('Reviews and milestones', () => {
  const a = analyse(sample());
  it('writes the reviews page', () => {
    const v = buildReviews(a);
    expect(v.headline).toBe('One review has been stuck for 6 days.');
    expect(v.lead).toBe('Three more are waiting on you. Your target is a first response within 2 days.');
    expect(v.mine.map((r) => [r.context, r.who, r.wait_label, r.action.label])).toEqual([
      ['lattice · pull request 491 · by J. Lin · 6 files · checks pass', 'Your review', '4 days', 'Review'],
      ['web-app · pull request 744 · yours · P. Nair asked for changes', 'Your changes', '2 days', 'Revise'],
      ['kit · pull request 101 · by A. Rao · 3 files · checks pass', 'Your review', '1 day', 'Review'],
    ]);
    expect(v.others.map((r) => [r.who, r.holds_up])).toEqual([['M. Tanaka', 'Holds up v0.9'], ['C. Okafor', null]]);
    expect(v.load.map((l) => [l.name, l.waiting, l.oldest_days])).toEqual([['You', 2, 4], ['M. Tanaka', 1, 6], ['C. Okafor', 1, 2]]);
    expect(shellInfo(a).reviews_badge).toBe(3);
  });

  it('writes the milestones page', () => {
    const v = buildMilestones(a);
    expect(v.headline).toBe('One milestone will be late. One is at risk.');
    expect(v.lead).toBe('The other two will land early at the current pace.');
    expect(v.rows.map((r) => [r.title, r.dates, r.difference_text, r.note])).toEqual([
      ['v0.9', 'Due 21 November, lands 26 November', '5 days late', 'The review stalled on pull request 479 is the hold-up.'],
      ['November release', 'Due 18 November, lands 18 November', 'At risk, no days to spare', 'Holds only if pull request 1214 passes its checks this week.'],
      ['Q4 polish', 'Due 12 December, lands 2 December', '10 days early', 'Nothing is in the way.'],
      ['v2.0', 'Due 15 January, lands 13 January', '2 days early', 'Nothing is in the way.'],
    ]);
    expect(v.axis.marks.map((m) => [m.label, Math.round(m.at * 1000) / 10])).toEqual([['1 Dec', 29.4], ['1 Jan', 75]]);
    expect(Math.round(v.rows[0].due_at * 1000) / 10).toBe(14.7);
  });
});
