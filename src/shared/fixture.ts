// Turns design/sample-data.json into a Dataset. The fixture's "expected" blocks are
// answers for tests, never inputs.

import type { Dataset, Item, Repository, Settings } from './types.js';
import { DEFAULT_SETTINGS } from './types.js';

export interface FixtureMilestone {
  title: string;
  due: string | null;
  open: number;
  closed: number;
  closed_in_pace_window: number;
}

export interface FixtureRepository {
  full_name: string;
  owner: string;
  name: string;
  unlisted_backlog_issues: number;
  milestone: FixtureMilestone | null;
  /** Sample-only details for the "Choose repositories" screen. */
  sample?: SampleRepositoryDetails;
}

export interface SampleRepositoryDetails {
  role: 'Maintainer' | 'Contributor';
  last_active: string;
}

export interface Fixture {
  today: string;
  viewer: string;
  settings: Settings;
  repositories: FixtureRepository[];
  items: (Item & { expected?: unknown })[];
  expected?: unknown;
}

function milestones(m: FixtureMilestone | null, fixtureWindow: number) {
  if (!m) return [];
  // The fixture gives closures for one pace window only. Other windows are scaled from it so
  // the sample responds when the pace window setting changes.
  const rate = m.closed_in_pace_window / fixtureWindow;
  const closed_in_window: Record<number, number> = {};
  for (const w of [7, 14, 30]) closed_in_window[w] = Math.round(rate * w);
  closed_in_window[fixtureWindow] = m.closed_in_pace_window;
  return [{ title: m.title, due: m.due, open: m.open, closed: m.closed, closed_in_window, url: null }];
}

export function fixtureRepository(r: FixtureRepository, window: number): Repository {
  return {
    full_name: r.full_name,
    owner: r.owner,
    name: r.name,
    url: null,
    unlisted_backlog_issues: r.unlisted_backlog_issues,
    milestones: milestones(r.milestone, window),
    sync_state: 'ok',
  };
}

export function datasetFromFixture(f: Fixture, overrides: Partial<Settings> = {}): Dataset {
  const window = f.settings.pace_window_days;
  return {
    today: f.today,
    viewer: f.viewer,
    settings: { ...DEFAULT_SETTINGS, ...f.settings, ...overrides },
    repositories: f.repositories.map((r) => fixtureRepository(r, window)),
    items: f.items.map((raw) => {
      const { expected: _expected, ...item } = raw;
      void _expected;
      return { ...item, labels: (item as { labels?: string[] }).labels ?? [], url: null } as Item;
    }),
  };
}
