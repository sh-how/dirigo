// Shapes the app's own API returns beyond the screen view models in views.ts.

import type { Settings } from './types.js';

export type Mode = 'sample' | 'live';

export interface Problem {
  code: 'not_found' | 'access_revoked' | 'rate_limited' | 'unreachable';
  repository: string | null;
  message: string;
}

export interface MeView {
  mode: Mode;
  user: { login: string; name: string | null } | null;
  reviews_badge: number;
  /** Two short lines for the bottom of the sidebar. */
  sync_lines: string[];
  watching: number;
  /** True while any watched repository has not finished its first sync. */
  syncing: boolean;
  problems: Problem[];
  install_url: string | null;
}

export interface AvailableRepository {
  full_name: string;
  name: string;
  owner: string;
  role: 'Maintainer' | 'Contributor';
  last_active: string | null;
  open: number;
  suggested: boolean;
  ticked: boolean;
  available: boolean;
  unavailable_reason: string | null;
  request_url: string | null;
}

export interface AvailableView {
  today: string;
  active_count: number;
  repositories: AvailableRepository[];
  install_url: string | null;
  no_installations: boolean;
}

export interface SettingsView {
  settings: Settings;
  watched: { full_name: string; name: string; owner: string }[];
  connection: { login: string | null; repositories: number };
  in_progress_options: { value: Settings['in_progress_rule']; label: string; available: boolean }[];
  pace_options: number[];
}

/** Open question 11: only the first two options ship until the others are designed. */
export const IN_PROGRESS_OPTIONS: SettingsView['in_progress_options'] = [
  { value: 'linked_pull_request', label: 'A pull request is linked to it', available: true },
  { value: 'assigned', label: 'It is assigned to someone', available: true },
  { value: 'label', label: 'It has a label I choose', available: false },
  { value: 'project_column', label: 'It sits in a column of a GitHub project', available: false },
];

export const PACE_OPTIONS = [14, 7, 30];

export interface ApiErrorBody {
  error: { code: string; message: string };
}
