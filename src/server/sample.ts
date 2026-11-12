// The sample dashboard: design/sample-data.json, shown signed out and clearly marked as
// sample data. Nothing here is real. The viewer's sample choices (watched repositories,
// rules) live in their browser and arrive with each request.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { datasetFromFixture, fixtureRepository, type Fixture, type FixtureRepository } from '../shared/fixture.js';
import type { Dataset, Settings } from '../shared/types.js';
import { DEFAULT_SETTINGS } from '../shared/types.js';
import type { AvailableView } from '../shared/api.js';

export interface SampleState {
  watched: string[] | null;
  settings: Partial<Settings>;
}

/** Repositories offered on the sample "Choose repositories" screen beyond the four watched ones. */
const EXTRA: FixtureRepository[] = [
  { full_name: 'northwind/docs-site', owner: 'northwind', name: 'docs-site', unlisted_backlog_issues: 11, milestone: null,
    sample: { role: 'Contributor', last_active: '2026-11-02' } },
  { full_name: 'lattice-db/lattice-bench', owner: 'lattice-db', name: 'lattice-bench', unlisted_backlog_issues: 2, milestone: null,
    sample: { role: 'Contributor', last_active: '2026-10-21' } },
];

const ACTIVITY: Record<string, { role: 'Maintainer' | 'Contributor'; last_active: string }> = {
  'lattice-db/lattice': { role: 'Maintainer', last_active: '2026-11-11T07:00:00Z' },
  'northwind/api': { role: 'Maintainer', last_active: '2026-11-11T05:00:00Z' },
  'northwind/web-app': { role: 'Contributor', last_active: '2026-11-10' },
  'papertrail-ui/kit': { role: 'Contributor', last_active: '2026-11-10' },
};

let cached: Fixture | null = null;

export function loadFixture(path = resolve(process.cwd(), 'design/sample-data.json')): Fixture {
  if (!cached) cached = JSON.parse(readFileSync(path, 'utf8')) as Fixture;
  return cached;
}

const ALLOWED_SETTINGS: (keyof Settings)[] = ['review_target_days', 'stalled_after_days', 'pace_window_days', 'in_progress_rule'];

export function parseSampleState(header: string | undefined): SampleState {
  if (!header) return { watched: null, settings: {} };
  try {
    const raw = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as Partial<SampleState>;
    const settings: Partial<Settings> = {};
    for (const k of ALLOWED_SETTINGS) {
      if (raw.settings && k in raw.settings) (settings as Record<string, unknown>)[k] = raw.settings[k];
    }
    return {
      watched: Array.isArray(raw.watched) ? raw.watched.filter((x): x is string => typeof x === 'string').slice(0, 50) : null,
      settings: validateSettings({ ...DEFAULT_SETTINGS, ...settings }) ? settings : {},
    };
  } catch {
    return { watched: null, settings: {} };
  }
}

export function validateSettings(s: Settings): boolean {
  const int = (n: unknown, lo: number, hi: number) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
  return int(s.review_target_days, 1, 30)
    && int(s.stalled_after_days, 1, 60)
    && [7, 14, 30].includes(s.pace_window_days)
    && ['linked_pull_request', 'assigned'].includes(s.in_progress_rule);
}

export function sampleDataset(state: SampleState): Dataset {
  const f = loadFixture();
  const ds = datasetFromFixture(f, state.settings);
  const all = [...ds.repositories, ...EXTRA.map((r) => fixtureRepository(r, f.settings.pace_window_days))];
  const watched = state.watched ?? f.repositories.map((r) => r.full_name);
  ds.repositories = all.filter((r) => watched.includes(r.full_name));
  ds.items = ds.items.filter((i) => watched.includes(i.repository));
  return ds;
}

export function sampleAvailable(state: SampleState): AvailableView {
  const f = loadFixture();
  const full = sampleDataset({ watched: [...f.repositories, ...EXTRA].map((r) => r.full_name), settings: {} });
  const open = (name: string) => {
    const r = full.repositories.find((x) => x.full_name === name)!;
    return full.items.filter((i) => i.repository === name).length + r.unlisted_backlog_issues;
  };
  const watched = state.watched ?? f.repositories.map((r) => r.full_name);
  const repos = [...f.repositories.map((r) => ({ ...r, sample: ACTIVITY[r.full_name] })), ...EXTRA];
  return {
    today: f.today,
    active_count: repos.length,
    repositories: repos.map((r) => ({
      full_name: r.full_name, name: r.name, owner: r.owner,
      role: r.sample?.role ?? 'Contributor', last_active: r.sample?.last_active ?? null,
      open: open(r.full_name), suggested: true, ticked: watched.includes(r.full_name),
      available: true, unavailable_reason: null, request_url: null,
    })),
    install_url: null,
    no_installations: false,
  };
}
