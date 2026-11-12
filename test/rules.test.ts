import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyse, classify } from '../src/shared/rules';
import { datasetFromFixture, type Fixture } from '../src/shared/fixture';
import type { Dataset, PullRequestItem } from '../src/shared/types';

const fixture = JSON.parse(readFileSync('design/sample-data.json', 'utf8')) as Fixture & {
  items: { repository: string; number: number; expected: Record<string, unknown> }[];
};

function sample(): Dataset {
  return datasetFromFixture(fixture);
}

const key = (r: string, n: number) => `${r}#${n}`;
const L = 'lattice-db/lattice';
const A = 'northwind/api';
const W = 'northwind/web-app';
const K = 'papertrail-ui/kit';

describe('rules engine on the sample fixture', () => {
  const a = analyse(sample());
  const byName = Object.fromEntries(a.repositories.map((r) => [r.repository.name, r]));

  it('counts open items and stages', () => {
    expect(a.open_items).toBe(42);
    expect(a.stage_counts).toEqual({ backlog: 23, in_progress: 6, needs_review: 4, open_pull_requests: 9 });
  });

  it('sorts every item into one bucket', () => {
    expect(a.buckets).toEqual({ blocked: 2, needs_your_decision: 3, on_track: 37 });
    expect(a.buckets.blocked + a.buckets.needs_your_decision + a.buckets.on_track).toBe(a.open_items);
  });

  it('finds the blocked items and what waits on you', () => {
    expect(a.blocked.map((c) => c.key).sort()).toEqual([key(L, 479), key(A, 1214)].sort());
    expect(a.waiting_on_you.map((c) => c.key)).toEqual([key(L, 491), key(W, 744), key(K, 101)]);
  });

  it('flags reviews past target and issues with no owner', () => {
    expect(a.items.filter((c) => c.past_review_target).map((c) => c.key).sort()).toEqual([key(L, 479), key(L, 491)]);
    expect(a.no_owner).toBe(5);
    expect(a.items.filter((c) => c.ready_to_merge)).toHaveLength(3);
  });

  it('computes each repository', () => {
    const stages = (n: string) => Object.values(byName[n].stage_counts);
    expect(stages('lattice')).toEqual([9, 2, 2, 3]);
    expect(stages('api')).toEqual([7, 2, 1, 3]);
    expect(stages('web-app')).toEqual([4, 1, 0, 2]);
    expect(stages('kit')).toEqual([3, 1, 1, 1]);
    expect(a.repositories.map((r) => r.repository.name)).toEqual(['lattice', 'api', 'web-app', 'kit']);
    expect(a.repositories.map((r) => r.status)).toEqual(['behind', 'at_risk', 'on_track', 'on_track']);
    expect(a.repositories.map((r) => r.open_items)).toEqual([16, 13, 7, 6]);
    expect(byName.lattice.stuck_stage).toBe('needs_review');
    expect(byName.api.stuck_stage).toBe('open_pull_requests');
  });

  it('projects each milestone', () => {
    const m = (n: string) => byName[n].next_milestone!;
    expect(['lattice', 'api', 'web-app', 'kit'].map((n) => m(n).percent_done)).toEqual([62, 78, 85, 40]);
    expect(['lattice', 'api', 'web-app', 'kit'].map((n) => m(n).landing)).toEqual(['2026-11-26', '2026-11-18', '2026-12-02', '2027-01-13']);
    expect(['lattice', 'api', 'web-app', 'kit'].map((n) => m(n).difference_days)).toEqual([-5, 0, 10, 2]);
    expect(a.milestones.map((p) => p.status)).toEqual(['late', 'at_risk', 'on_track', 'on_track']);
  });

  it('matches the per-item expectations in the fixture', () => {
    const ds = sample();
    const repos = new Map(ds.repositories.map((r) => [r.full_name, r]));
    for (const raw of fixture.items) {
      const item = ds.items.find((i) => i.repository === raw.repository && i.number === raw.number)!;
      const c = classify(item, ds, repos.get(item.repository));
      const e = raw.expected;
      expect({ key: c.key, stage: c.stage, bucket: c.bucket, wait_days: c.item.kind === 'issue' ? null : c.wait_days,
        past: c.past_review_target, no_owner: c.no_owner, ready: c.ready_to_merge })
        .toEqual({ key: c.key, stage: e.stage, bucket: e.bucket, wait_days: e.wait_days,
          past: e.past_review_target, no_owner: e.no_owner, ready: e.ready_to_merge });
    }
  });
});

describe('rules engine reacting to changes', () => {
  it('produces the nothing-blocked state when the blocked items are removed', () => {
    const ds = sample();
    ds.items = ds.items.filter((i) => !(i.number === 479 || i.number === 1214));
    const a = analyse(ds);
    expect(a.buckets.blocked).toBe(0);
    expect(a.blocked).toHaveLength(0);
  });

  it('uses the review target setting', () => {
    const ds = sample();
    ds.settings.review_target_days = 5;
    const a = analyse(ds);
    expect(a.items.filter((c) => c.past_review_target).map((c) => c.key)).toEqual([key(L, 479)]);
  });

  it('uses the stalled setting', () => {
    const ds = sample();
    ds.settings.stalled_after_days = 10;
    const a = analyse(ds);
    expect(a.blocked.map((c) => c.key)).toEqual([key(A, 1214)]);
  });

  it('supports the assigned rule for in progress', () => {
    const ds = sample();
    ds.settings.in_progress_rule = 'assigned';
    const a = analyse(ds);
    const backlog = a.items.filter((c) => c.stage === 'backlog');
    expect(backlog.every((c) => c.no_owner)).toBe(true);
    expect(a.open_items).toBe(42);
  });

  it('treats zero pace as late with no landing date', () => {
    const ds = sample();
    ds.repositories[2].milestones[0].closed_in_window[14] = 0;
    const a = analyse(ds);
    const web = a.repositories.find((r) => r.repository.name === 'web-app')!;
    expect(web.next_milestone!.landing).toBeNull();
    expect(web.status).toBe('behind');
  });

  it('never blocks an item outside a milestone', () => {
    const ds = sample();
    const pr = ds.items.find((i) => i.number === 479)!;
    pr.milestone = null;
    expect(analyse(ds).blocked.map((c) => c.key)).toEqual([key(A, 1214)]);
  });

  it('counts an unrequested, unreviewed pull request as needing review from any reviewer', () => {
    const ds = sample();
    const base = ds.items.find((i) => i.number === 493) as PullRequestItem;
    ds.items.push({ ...base, number: 999, review_decision: null, reviewed: false, requested_reviewers: [] });
    const c = analyse(ds).items.find((x) => x.item.number === 999)!;
    expect(c.stage).toBe('needs_review');
    expect(c.waiting_on).toEqual(['any reviewer']);
  });
});
