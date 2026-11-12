// The client's only way to reach data: the app's own API. In sample mode the viewer's
// choices are kept in this browser and sent with each request.

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import type { AvailableView, MeView, SettingsView } from '../shared/api';
import type { Settings } from '../shared/types';
import type {
  MilestonesView, RepositoriesView, RepositoryView, ReviewsView, TodayView, WorkQuery, WorkView,
} from '../shared/views';

export class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// ---- Sample state ---------------------------------------------------------------------------

const SAMPLE_KEY = 'dirigo.sample';

export interface SampleState {
  watched: string[] | null;
  settings: Partial<Settings>;
}

export function readSample(): SampleState {
  try {
    const raw = localStorage.getItem(SAMPLE_KEY);
    if (raw) return JSON.parse(raw) as SampleState;
  } catch {
    /* storage unavailable */
  }
  return { watched: null, settings: {} };
}

export function writeSample(next: SampleState): void {
  try {
    localStorage.setItem(SAMPLE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the change lasts until the page reloads */
  }
  memorySample = next;
}

let memorySample: SampleState | null = null;

function sampleHeader(): string {
  const s = memorySample ?? readSample();
  return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

// ---- Mode -----------------------------------------------------------------------------------

export function isSamplePath(pathname: string): boolean {
  return pathname === '/sample' || pathname.startsWith('/sample/');
}

export function useSample(): boolean {
  return isSamplePath(useLocation().pathname);
}

/** Build an in-app path for the current mode. */
export function usePaths() {
  const sample = useSample();
  return (p: string) => (sample ? `/sample${p}` : p);
}

// ---- Fetching -------------------------------------------------------------------------------

async function call<T>(sample: boolean, path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (sample) headers['x-dirigo-sample'] = sampleHeader();
  if (init.method && init.method !== 'GET') {
    headers['x-dirigo-csrf'] = '1';
    headers['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`${sample ? '/api/sample' : '/api'}${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiFailure(0, 'offline', 'Dirigo could not be reached. Check your connection; the page will try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (body as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiFailure(res.status, e?.code ?? 'error', e?.message ?? 'Something went wrong.');
  }
  return body as T;
}

function useApi<T>(path: string, options: { refetchInterval?: number | false | ((data: T | undefined) => number | false) } = {}) {
  const sample = useSample();
  return useQuery<T, ApiFailure>({
    queryKey: [sample ? 'sample' : 'live', path],
    queryFn: () => call<T>(sample, path),
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval
      ? (q) => (typeof options.refetchInterval === 'function' ? options.refetchInterval(q.state.data) : options.refetchInterval!)
      : undefined,
  });
}

export const useMe = () => useApi<MeView>('/me', { refetchInterval: (d) => (d?.syncing ? 5_000 : 60_000) });
export const useToday = () => useApi<TodayView>('/today', { refetchInterval: (d) => (d?.state === 'syncing' ? 5_000 : 120_000) });
export const useRepositories = () => useApi<RepositoriesView>('/repositories');
export const useReviews = () => useApi<ReviewsView>('/reviews');
export const useMilestones = () => useApi<MilestonesView>('/milestones');
export const useSettings = () => useApi<SettingsView>('/settings');
export const useAvailable = () => useApi<AvailableView>('/available-repositories');

export function useWork(q: WorkQuery) {
  const p = new URLSearchParams();
  if (q.filter && q.filter !== 'everything') p.set('filter', q.filter);
  if (q.rows && q.rows !== 'repository') p.set('rows', q.rows);
  if (q.person) p.set('person', q.person);
  if (q.label) p.set('label', q.label);
  const qs = p.toString();
  return useApi<WorkView>(`/work${qs ? `?${qs}` : ''}`);
}

export function useRepository(fullName: string, filter: string) {
  return useApi<RepositoryView>(`/repositories/${fullName}${filter !== 'everything' ? `?filter=${filter}` : ''}`);
}

// ---- Changes ---------------------------------------------------------------------------------

/** The only changes a user makes inside Dirigo. None of them writes to GitHub. */
export function useActions() {
  const sample = useSample();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();

  return {
    async setWatches(repositories: string[]) {
      if (sample) writeSample({ ...readSample(), watched: repositories });
      else await call(false, '/watches', { method: 'PUT', body: JSON.stringify({ repositories }) });
      await refresh();
    },
    async stopWatching(fullName: string) {
      if (sample) {
        const s = readSample();
        const current = s.watched ?? (qc.getQueryData<SettingsView>(['sample', '/settings'])?.watched.map((w) => w.full_name) ?? []);
        writeSample({ ...s, watched: current.filter((n) => n !== fullName) });
      } else await call(false, `/watches/${fullName}`, { method: 'DELETE' });
      await refresh();
    },
    async saveSettings(settings: Settings) {
      if (sample) writeSample({ ...readSample(), settings });
      else await call(false, '/settings', { method: 'PUT', body: JSON.stringify(settings) });
      await refresh();
    },
    async disconnect() {
      await call(false, '/connection', { method: 'DELETE' });
      qc.clear();
    },
    async signOut() {
      await call(false, '/signout', { method: 'POST' });
      qc.clear();
    },
    resetSample() {
      writeSample({ watched: null, settings: {} });
      return refresh();
    },
  };
}
