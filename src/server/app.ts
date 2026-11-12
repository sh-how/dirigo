// The HTTP app: the JSON API (sample and live), GitHub sign-in, webhooks and the built client.

import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from './config.js';
import { liveEnabled } from './config.js';
import { pkceChallenge, randomToken } from './crypto.js';
import { AccessRevoked, GitHubApp, NotFound, RateLimited, canRead, contributedRepositories, currentUser, installedRepositories } from './github/client.js';
import type { Jobs } from './jobs.js';
import type { Store, RepositoryRow, UserRow } from './store.js';
import { handleDelivery, verifySignature } from './webhooks.js';
import { parseSampleState, sampleAvailable, sampleDataset, validateSettings } from './sample.js';
import { analyse } from '../shared/rules.js';
import {
  buildMilestones, buildRepositories, buildRepository, buildReviews, buildToday, buildWork, shellInfo,
  type QuickFilter, type RowGrouping,
} from '../shared/views.js';
import type { AvailableRepository, AvailableView, MeView, Problem, SettingsView } from '../shared/api.js';
import { IN_PROGRESS_OPTIONS, PACE_OPTIONS } from '../shared/api.js';
import type { Dataset, Settings } from '../shared/types.js';
import { DEFAULT_SETTINGS } from '../shared/types.js';
import { daysBetween, minutesAgo } from '../shared/dates.js';

const SESSION_COOKIE = 'dirigo_session';
const OAUTH_COOKIE = 'dirigo_oauth';
const CSRF_HEADER = 'x-dirigo-csrf';

export class ApiError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 502 | 503, public code: string, message: string) {
    super(message);
  }
}

export interface Live {
  store: Store;
  app: GitHubApp;
  jobs: Jobs;
}

interface Loaded {
  ds: Dataset;
  me: MeView;
  user: UserRow | null;
  repos: RepositoryRow[];
}

function fromError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof AccessRevoked) return new ApiError(401, 'access_revoked', 'GitHub no longer accepts your sign-in. Connect GitHub again to continue.');
  if (err instanceof RateLimited) return new ApiError(503, 'rate_limited', `GitHub has asked Dirigo to slow down. Try again after ${err.retryAt.toISOString().slice(11, 16)} UTC.`);
  if (err instanceof NotFound) return new ApiError(404, 'not_found', 'That could not be found on GitHub.');
  console.error(err);
  return new ApiError(502, 'unreachable', 'GitHub could not be reached. The page will try again shortly.');
}

function problemFor(r: RepositoryRow): Problem | null {
  switch (r.sync_error) {
    case 'not_found': return { code: 'not_found', repository: r.full_name, message: `${r.name} could not be found on GitHub. It may have been renamed or removed.` };
    case 'access_revoked': return { code: 'access_revoked', repository: r.full_name, message: `Dirigo can no longer read ${r.name}. Its owner may have removed access.` };
    case 'rate_limited': return { code: 'rate_limited', repository: r.full_name, message: `GitHub asked Dirigo to slow down while reading ${r.name}. It will try again shortly.` };
    case 'unreachable': return { code: 'unreachable', repository: r.full_name, message: `GitHub could not be reached while reading ${r.name}. The data shown may be out of date.` };
    default: return null;
  }
}

export function createApp(cfg: Config, live: Live | null): Hono {
  const app = new Hono();
  const secure = cfg.production;

  app.use('*', secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'", 'https://github.com'],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
  }));

  app.onError((err, c) => {
    const e = fromError(err);
    return c.json({ error: { code: e.code, message: e.message } }, e.status);
  });

  // Cross-site request forgery: every state-changing request must carry a custom header,
  // which a cross-site form or image cannot send, and a same-origin Origin when present.
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !c.req.path.startsWith('/api/webhooks/')) {
      const origin = c.req.header('origin');
      if (c.req.header(CSRF_HEADER) !== '1' || (origin && new URL(origin).origin !== new URL(cfg.appUrl).origin)) {
        throw new ApiError(403, 'forbidden', 'This request was refused.');
      }
    }
    await next();
  });

  // ---- Shared endpoint logic -------------------------------------------------------------

  const views = (base: string, load: (c: Context) => Promise<Loaded>) => {
    app.get(`${base}/me`, async (c) => c.json((await load(c)).me));
    app.get(`${base}/today`, async (c) => {
      const { ds } = await load(c);
      const view = buildToday(analyse(ds));
      const pending = ds.repositories.length > 0 && ds.repositories.every((r) => r.sync_state === 'pending');
      return c.json(pending ? { ...view, state: 'syncing' } : view);
    });
    app.get(`${base}/work`, async (c) => {
      const { ds } = await load(c);
      const q = c.req.query();
      const filter = (['everything', 'blocked', 'waiting', 'no_owner'].includes(q.filter) ? q.filter : 'everything') as QuickFilter;
      const rows = (['repository', 'person', 'milestone', 'none'].includes(q.rows) ? q.rows : 'repository') as RowGrouping;
      return c.json(buildWork(analyse(ds), { filter, rows, person: q.person || null, label: q.label || null }));
    });
    app.get(`${base}/repositories`, async (c) => c.json(buildRepositories(analyse((await load(c)).ds))));
    app.get(`${base}/repositories/:owner/:name`, async (c) => {
      const { ds } = await load(c);
      const f = c.req.query('filter');
      const filter = f === 'blocked' || f === 'waiting' ? f : 'everything';
      const view = buildRepository(analyse(ds), `${c.req.param('owner')}/${c.req.param('name')}`, filter);
      if (!view) throw new ApiError(404, 'not_found', 'You are not watching that repository.');
      return c.json(view);
    });
    app.get(`${base}/reviews`, async (c) => c.json(buildReviews(analyse((await load(c)).ds))));
    app.get(`${base}/milestones`, async (c) => c.json(buildMilestones(analyse((await load(c)).ds))));
    app.get(`${base}/settings`, async (c) => {
      const { ds, me } = await load(c);
      const view: SettingsView = {
        settings: ds.settings,
        watched: ds.repositories.map((r) => ({ full_name: r.full_name, name: r.name, owner: r.owner })),
        connection: { login: me.user?.login ?? null, repositories: ds.repositories.length },
        in_progress_options: IN_PROGRESS_OPTIONS,
        pace_options: PACE_OPTIONS,
      };
      return c.json(view);
    });
  };

  // ---- Sample mode -----------------------------------------------------------------------

  const loadSample = async (c: Context): Promise<Loaded> => {
    const state = parseSampleState(c.req.header('x-dirigo-sample'));
    const ds = sampleDataset(state);
    const a = analyse(ds);
    const me: MeView = {
      mode: 'sample', user: null, reviews_badge: shellInfo(a).reviews_badge,
      sync_lines: ['Sample data', 'Not connected to GitHub'],
      watching: ds.repositories.length, syncing: false, problems: [], install_url: null,
    };
    return { ds, me, user: null, repos: [] };
  };
  views('/api/sample', loadSample);
  app.get('/api/sample/available-repositories', (c) => c.json(sampleAvailable(parseSampleState(c.req.header('x-dirigo-sample')))));

  // ---- Live mode -------------------------------------------------------------------------

  const requireLive = (): Live => {
    if (!live) throw new ApiError(503, 'not_configured', 'Signing in with GitHub is not set up on this server yet.');
    return live;
  };

  const currentUserRow = async (c: Context): Promise<UserRow> => {
    const { store } = requireLive();
    const token = getCookie(c, SESSION_COOKIE);
    const user = token ? await store.userForSession(token) : null;
    if (!user) throw new ApiError(401, 'not_signed_in', 'Sign in with GitHub to see your dashboard.');
    return user;
  };

  /** Only repositories the user can read on GitHub right now are served. */
  const accessibleRepositories = async (user: UserRow, token: string): Promise<RepositoryRow[]> => {
    const { store } = requireLive();
    const watched = await store.watched(user.id);
    const fresh = await store.freshAccess(user.id, cfg.accessCheckMinutes);
    const results = await Promise.all(watched.map(async (r) => {
      if (fresh.has(r.id)) return fresh.get(r.id)!;
      const ok = await canRead(token, r.owner, r.name);
      await store.recordAccess(user.id, r.id, ok);
      if (!ok) await store.unwatch(user.id, r.id);
      return ok;
    }));
    return watched.filter((_, i) => results[i]);
  };

  const loadLive = async (c: Context): Promise<Loaded> => {
    const l = requireLive();
    const user = await currentUserRow(c);
    const token = await l.store.userToken(user, l.app);
    const repos = await accessibleRepositories(user, token);
    await l.store.logAccess(user.id, repos, c.req.path);
    const ds = await l.store.dataset(repos, user.login, l.store.settings(user));
    const a = analyse(ds);
    const synced = repos.map((r) => r.last_synced_at).filter((d): d is Date => !!d);
    const oldest = synced.length ? new Date(Math.min(...synced.map((d) => d.getTime()))) : null;
    const syncing = repos.some((r) => !r.last_synced_at);
    const me: MeView = {
      mode: 'live',
      user: { login: user.login, name: user.name },
      reviews_badge: shellInfo(a).reviews_badge,
      sync_lines: repos.length === 0 ? ['No repositories yet']
        : syncing ? ['Reading your repositories']
        : [`Synced ${minutesAgo(oldest!.toISOString(), new Date().toISOString())}`],
      watching: repos.length,
      syncing,
      problems: repos.map(problemFor).filter((p): p is Problem => !!p),
      install_url: l.app.installUrl(),
    };
    return { ds, me, user, repos };
  };
  views('/api', loadLive);

  app.get('/api/available-repositories', async (c) => {
    const l = requireLive();
    const user = await currentUserRow(c);
    const token = await l.store.userToken(user, l.app);
    return c.json(await availableFor(l, user, token));
  });

  app.put('/api/watches', async (c) => {
    const l = requireLive();
    const user = await currentUserRow(c);
    const body = await c.req.json<{ repositories?: unknown }>().catch(() => ({ repositories: null }));
    if (!Array.isArray(body.repositories) || body.repositories.some((x) => typeof x !== 'string')) {
      throw new ApiError(400, 'bad_request', 'Send a list of repository names.');
    }
    const wanted = new Set((body.repositories as string[]).map((s) => s.toLowerCase()));
    const token = await l.store.userToken(user, l.app);
    // Never trust the client's list: only repositories the user can read are accepted.
    const installed = await installedRepositories(token);
    const contributed = await contributedRepositories(token).catch(() => []);
    const rows: Omit<RepositoryRow, 'last_synced_at' | 'sync_error'>[] = [];
    for (const { installationId, repo } of installed) {
      if (!wanted.has(repo.full_name.toLowerCase())) continue;
      rows.push({ id: String(repo.id), owner: repo.owner.login, name: repo.name, full_name: repo.full_name, private: repo.private, url: repo.html_url, installation_id: String(installationId) });
    }
    for (const r of contributed) {
      if (r.isPrivate || !wanted.has(r.nameWithOwner.toLowerCase()) || rows.some((x) => x.full_name.toLowerCase() === r.nameWithOwner.toLowerCase())) continue;
      rows.push({ id: String(r.databaseId), owner: r.owner.login, name: r.name, full_name: r.nameWithOwner, private: false, url: r.url, installation_id: null });
    }
    const needSync = await l.store.setWatches(user.id, rows);
    for (const id of needSync) await l.jobs.enqueueSync(id);
    return c.json({ watching: rows.map((r) => r.full_name) });
  });

  app.delete('/api/watches/:owner/:name', async (c) => {
    const l = requireLive();
    const user = await currentUserRow(c);
    const repo = await l.store.repositoryByName(`${c.req.param('owner')}/${c.req.param('name')}`);
    if (repo) await l.store.unwatch(user.id, repo.id);
    return c.json({ ok: true });
  });

  app.put('/api/settings', async (c) => {
    const l = requireLive();
    const user = await currentUserRow(c);
    const body: Partial<Settings> = await c.req.json<Partial<Settings>>().catch(() => ({}));
    const next: Settings = {
      ...DEFAULT_SETTINGS,
      ...l.store.settings(user),
      review_target_days: Number(body.review_target_days),
      stalled_after_days: Number(body.stalled_after_days),
      pace_window_days: Number(body.pace_window_days),
      in_progress_rule: body.in_progress_rule ?? 'linked_pull_request',
    };
    if (!validateSettings(next)) throw new ApiError(400, 'bad_request', 'Those rules are not valid.');
    await l.store.saveSettings(user.id, next);
    return c.json({ settings: next });
  });

  app.delete('/api/connection', async (c) => {
    const l = requireLive();
    const user = await currentUserRow(c);
    await l.store.deleteUser(user.id);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.post('/api/signout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token && live) await live.store.deleteSession(token);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  // ---- GitHub sign-in --------------------------------------------------------------------

  const redirectUri = `${cfg.appUrl}/auth/github/callback`;

  app.get('/auth/github', (c) => {
    if (!live || !liveEnabled(cfg)) return c.redirect('/connect?error=not_configured');
    const state = randomToken(24);
    const verifier = randomToken(48);
    setCookie(c, OAUTH_COOKIE, JSON.stringify({ state, verifier }), { httpOnly: true, secure, sameSite: 'Lax', path: '/auth', maxAge: 600 });
    return c.redirect(live.app.authorizeUrl(redirectUri, state, pkceChallenge(verifier)));
  });

  app.get('/auth/github/callback', async (c) => {
    if (!live) return c.redirect('/connect?error=not_configured');
    const raw = getCookie(c, OAUTH_COOKIE);
    deleteCookie(c, OAUTH_COOKIE, { path: '/auth' });
    if (c.req.query('error')) return c.redirect('/connect?error=cancelled');
    let saved: { state?: string; verifier?: string };
    try { saved = raw ? JSON.parse(raw) : {}; } catch { saved = {}; }
    const code = c.req.query('code');
    if (!code || !saved.state || !saved.verifier || saved.state !== c.req.query('state')) return c.redirect('/connect?error=expired');
    try {
      const tokens = await live.app.exchangeCode(code, redirectUri, saved.verifier);
      const gh = await currentUser(tokens.accessToken);
      const userId = await live.store.upsertUser(gh, tokens);
      const session = await live.store.createSession(userId);
      setCookie(c, SESSION_COOKIE, session, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: 30 * 86_400 });
      const watched = await live.store.watched(userId);
      return c.redirect(watched.length ? '/today' : '/setup/repositories');
    } catch (err) {
      console.error('[auth]', err instanceof Error ? err.message : err);
      return c.redirect('/connect?error=failed');
    }
  });

  // ---- Webhooks --------------------------------------------------------------------------

  app.post('/api/webhooks/github', async (c) => {
    if (!live || !cfg.github) return c.json({ error: { code: 'not_configured', message: 'Webhooks are not set up.' } }, 503);
    const body = await c.req.text();
    if (!(await verifySignature(cfg.github.webhookSecret, body, c.req.header('x-hub-signature-256')))) {
      return c.json({ error: { code: 'bad_signature', message: 'Signature does not match.' } }, 401);
    }
    const id = c.req.header('x-github-delivery');
    const event = c.req.header('x-github-event');
    if (!id || !event) return c.json({ error: { code: 'bad_request', message: 'Missing delivery headers.' } }, 400);
    await handleDelivery(live.store, live.jobs, id, event, JSON.parse(body));
    return c.json({ ok: true }, 202);
  });

  // ---- The built client ------------------------------------------------------------------

  const clientDir = resolve(process.cwd(), 'dist/client');
  if (existsSync(clientDir)) {
    const index = readFileSync(resolve(clientDir, 'index.html'), 'utf8');
    app.use('/assets/*', serveStatic({ root: 'dist/client' }));
    app.use('/favicon.svg', serveStatic({ root: 'dist/client' }));
    app.use('/theme.js', serveStatic({ root: 'dist/client' }));
    app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404) : c.html(index)));
  }

  return app;
}

async function availableFor(l: Live, user: UserRow, token: string): Promise<AvailableView> {
  const today = new Date().toISOString().slice(0, 10);
  const installed = await installedRepositories(token);
  const contributed = await contributedRepositories(token).catch(() => []);
  const watched = new Set((await l.store.watched(user.id)).map((r) => r.full_name.toLowerCase()));
  const byName = new Map<string, AvailableRepository>();
  for (const { repo } of installed) {
    if (repo.archived) continue;
    byName.set(repo.full_name.toLowerCase(), {
      full_name: repo.full_name, name: repo.name, owner: repo.owner.login,
      role: repo.permissions?.admin || repo.permissions?.maintain ? 'Maintainer' : 'Contributor',
      last_active: repo.pushed_at, open: repo.open_issues_count, suggested: false, ticked: false,
      available: true, unavailable_reason: null, request_url: null,
    });
  }
  for (const r of contributed) {
    const k = r.nameWithOwner.toLowerCase();
    if (byName.has(k) || r.isArchived) continue;
    byName.set(k, {
      full_name: r.nameWithOwner, name: r.name, owner: r.owner.login,
      role: r.viewerPermission === 'ADMIN' || r.viewerPermission === 'MAINTAIN' ? 'Maintainer' : 'Contributor',
      last_active: r.pushedAt, open: r.issues.totalCount + r.pullRequests.totalCount, suggested: false, ticked: false,
      available: !r.isPrivate,
      unavailable_reason: r.isPrivate ? `An owner of ${r.owner.login} must approve Dirigo before it can read this repository.` : null,
      request_url: r.isPrivate ? l.app.installUrl() : null,
    });
  }
  const list = [...byName.values()].sort((a, b) => (b.last_active ?? '').localeCompare(a.last_active ?? ''));
  const active = list.filter((r) => r.last_active && daysBetween(r.last_active, today) <= 90);
  active.filter((r) => r.available).slice(0, 6).forEach((r) => (r.suggested = true));
  if (watched.size) list.forEach((r) => (r.ticked = watched.has(r.full_name.toLowerCase())));
  else active.filter((r) => r.available).slice(0, 4).forEach((r) => (r.ticked = true));
  return {
    today, active_count: active.length, repositories: list,
    install_url: l.app.installUrl(), no_installations: installed.length === 0,
  };
}

