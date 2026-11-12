// Every call Dirigo makes to GitHub. All of them read; none writes.

import { createAppAuth } from '@octokit/auth-app';
import { graphql as octoGraphql, GraphqlResponseError } from '@octokit/graphql';
import { request as octoRequest } from '@octokit/request';
import type { GitHubConfig } from '../config.js';

export class RateLimited extends Error {
  constructor(public readonly retryAt: Date) {
    super(`GitHub rate limit reached; retry after ${retryAt.toISOString()}`);
  }
}

export class AccessRevoked extends Error {
  constructor(message = 'GitHub no longer accepts this sign-in') {
    super(message);
  }
}

export class NotFound extends Error {}

interface HttpishError {
  status?: number;
  response?: { headers?: Record<string, string | undefined> };
}

/** Translate GitHub errors into the three cases the app handles. */
export function translate(err: unknown): unknown {
  if (err instanceof GraphqlResponseError) {
    if (err.errors?.some((e) => (e as { type?: string }).type === 'RATE_LIMITED')) {
      return new RateLimited(new Date(Date.now() + 60_000));
    }
    if (err.errors?.some((e) => (e as { type?: string }).type === 'NOT_FOUND')) return new NotFound(err.message);
    return err;
  }
  const e = err as HttpishError;
  if (e && typeof e.status === 'number') {
    const h = e.response?.headers ?? {};
    if (e.status === 429 || (e.status === 403 && (h['x-ratelimit-remaining'] === '0' || h['retry-after']))) {
      const retryAfter = h['retry-after'] ? Number(h['retry-after']) * 1000 : null;
      const reset = h['x-ratelimit-reset'] ? Number(h['x-ratelimit-reset']) * 1000 : null;
      return new RateLimited(new Date(retryAfter ? Date.now() + retryAfter : reset ?? Date.now() + 60_000));
    }
    if (e.status === 401) return new AccessRevoked();
    if (e.status === 404) return new NotFound('Not found');
  }
  return err;
}

export async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  try {
    return await octoGraphql<T>(query, { ...variables, headers: { authorization: `bearer ${token}` } });
  } catch (err) {
    throw translate(err);
  }
}

export async function rest<T>(token: string | null, route: string, params: Record<string, unknown> = {}): Promise<T> {
  try {
    const res = await octoRequest(route, {
      ...params,
      headers: token ? { authorization: `bearer ${token}` } : {},
    });
    return res.data as T;
  } catch (err) {
    throw translate(err);
  }
}

// ---- The GitHub App --------------------------------------------------------------------------

export class GitHubApp {
  private auth;
  constructor(private readonly cfg: GitHubConfig) {
    this.auth = createAppAuth({ appId: cfg.appId, privateKey: cfg.privateKey, clientId: cfg.clientId, clientSecret: cfg.clientSecret });
  }

  get slug(): string {
    return this.cfg.appSlug;
  }

  /** Short-lived installation token, created on demand and cached by the library. */
  async installationToken(installationId: number): Promise<string> {
    try {
      const a = await this.auth({ type: 'installation', installationId });
      return a.token;
    } catch (err) {
      throw translate(err);
    }
  }

  /** The installation that covers a repository, or null when the app is not installed there. */
  async installationFor(owner: string, repo: string): Promise<number | null> {
    const app = await this.auth({ type: 'app' });
    try {
      const data = await rest<{ id: number }>(app.token, 'GET /repos/{owner}/{repo}/installation', { owner, repo });
      return data.id;
    } catch (err) {
      if (err instanceof NotFound) return null;
      throw err;
    }
  }

  authorizeUrl(redirectUri: string, state: string, codeChallenge: string): string {
    const u = new URL('https://github.com/login/oauth/authorize');
    u.searchParams.set('client_id', this.cfg.clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('state', state);
    u.searchParams.set('code_challenge', codeChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
    u.searchParams.set('allow_signup', 'true');
    return u.toString();
  }

  installUrl(): string {
    return `https://github.com/apps/${this.cfg.appSlug}/installations/new`;
  }

  async exchangeCode(code: string, redirectUri: string, verifier: string): Promise<UserTokens> {
    return this.tokenRequest({ code, redirect_uri: redirectUri, code_verifier: verifier });
  }

  async refresh(refreshToken: string): Promise<UserTokens> {
    return this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  private async tokenRequest(params: Record<string, string>): Promise<UserTokens> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, ...params }),
    });
    const body = (await res.json()) as Record<string, string | number | undefined>;
    if (!res.ok || body.error || !body.access_token) {
      if (body.error === 'bad_refresh_token' || body.error === 'bad_verification_code') throw new AccessRevoked(String(body.error_description ?? body.error));
      throw new Error(`GitHub token request failed: ${String(body.error ?? res.status)}`);
    }
    const now = Date.now();
    return {
      accessToken: String(body.access_token),
      accessExpiresAt: body.expires_in ? new Date(now + Number(body.expires_in) * 1000) : null,
      refreshToken: body.refresh_token ? String(body.refresh_token) : null,
      refreshExpiresAt: body.refresh_token_expires_in ? new Date(now + Number(body.refresh_token_expires_in) * 1000) : null,
    };
  }
}

export interface UserTokens {
  accessToken: string;
  accessExpiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}

// ---- Calls made with a user's token ----------------------------------------------------------

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
}

export function currentUser(token: string): Promise<GitHubUser> {
  return rest<GitHubUser>(token, 'GET /user');
}

export interface RestRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  html_url: string;
  pushed_at: string | null;
  updated_at: string | null;
  open_issues_count: number;
  archived?: boolean;
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; pull?: boolean };
}

/** Repositories the user can reach through an installation of the app. */
export async function installedRepositories(token: string): Promise<{ installationId: number; repo: RestRepository }[]> {
  const out: { installationId: number; repo: RestRepository }[] = [];
  const installs = await rest<{ installations: { id: number }[] }>(token, 'GET /user/installations', { per_page: 100 });
  for (const inst of installs.installations) {
    for (let page = 1; page < 50; page++) {
      const data = await rest<{ repositories: RestRepository[] }>(token, 'GET /user/installations/{installation_id}/repositories', {
        installation_id: inst.id, per_page: 100, page,
      });
      out.push(...data.repositories.map((repo) => ({ installationId: inst.id, repo })));
      if (data.repositories.length < 100) break;
    }
  }
  return out;
}

export interface ContributedRepository {
  databaseId: number;
  nameWithOwner: string;
  name: string;
  owner: { login: string };
  isPrivate: boolean;
  isArchived: boolean;
  url: string;
  pushedAt: string | null;
  viewerPermission: string | null;
  issues: { totalCount: number };
  pullRequests: { totalCount: number };
}

/** Repositories the user has contributed to, including ones the app is not installed on. */
export async function contributedRepositories(token: string): Promise<ContributedRepository[]> {
  const data = await gql<{ viewer: { repositoriesContributedTo: { nodes: ContributedRepository[] } } }>(token, `
    query {
      viewer {
        repositoriesContributedTo(first: 100, includeUserRepositories: true,
          contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, PULL_REQUEST_REVIEW],
          orderBy: { field: PUSHED_AT, direction: DESC }) {
          nodes {
            databaseId nameWithOwner name owner { login } isPrivate isArchived url pushedAt viewerPermission
            issues(states: OPEN) { totalCount }
            pullRequests(states: OPEN) { totalCount }
          }
        }
      }
    }`);
  return data.viewer.repositoriesContributedTo.nodes.filter(Boolean);
}

/** Whether the user can read a repository right now. */
export async function canRead(token: string, owner: string, repo: string): Promise<boolean> {
  try {
    await rest(token, 'GET /repos/{owner}/{repo}', { owner, repo });
    return true;
  } catch (err) {
    if (err instanceof NotFound) return false;
    if ((err as HttpishError).status === 403) return false;
    throw err;
  }
}
