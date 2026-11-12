import { describe, expect, it } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { createApp } from '../src/server/app';
import { loadConfig } from '../src/server/config';
import { decrypt, encrypt, hashToken, pkceChallenge } from '../src/server/crypto';
import { linkIssues, mapIssue, mapPullRequest, type PullRequestNode } from '../src/server/github/map';
import { verifySignature } from '../src/server/webhooks';
import { parseSampleState } from '../src/server/sample';
import { translate, RateLimited, AccessRevoked } from '../src/server/github/client';

const cfg = loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);
const app = createApp(cfg, null);
const header = (state: unknown) => Buffer.from(JSON.stringify(state)).toString('base64');

describe('token encryption', () => {
  it('round-trips and detects tampering', () => {
    const key = randomBytes(32);
    const sealed = encrypt('ghu_secret', key);
    expect(sealed).not.toContain('ghu_secret');
    expect(decrypt(sealed, key)).toBe('ghu_secret');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
    expect(() => decrypt(sealed, randomBytes(32))).toThrow();
  });

  it('hashes session ids and builds PKCE challenges', () => {
    expect(hashToken('a')).toHaveLength(64);
    // RFC 7636 appendix B example.
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('webhook signatures', () => {
  it('accepts a correct signature and rejects the rest', async () => {
    const body = JSON.stringify({ action: 'opened' });
    const sig = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
    expect(await verifySignature('secret', body, sig)).toBe(true);
    expect(await verifySignature('other', body, sig)).toBe(false);
    expect(await verifySignature('secret', body, undefined)).toBe(false);
    expect(await verifySignature('secret', body + ' ', sig)).toBe(false);
  });
});

describe('GitHub mapping', () => {
  const pr: PullRequestNode = {
    number: 7, title: 'Add retries', url: 'https://github.com/o/r/pull/7', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-09T10:00:00Z',
    isDraft: false, reviewDecision: 'REVIEW_REQUIRED', changedFiles: 4, author: { login: 'ada' },
    assignees: { nodes: [] }, labels: { nodes: [{ name: 'bug' }] }, milestone: { title: 'v1' },
    reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'User', login: 'lin' } }, { requestedReviewer: { __typename: 'Team', slug: 'core' } }] },
    latestReviews: { nodes: [] },
    closingIssuesReferences: { nodes: [{ number: 3, repository: { nameWithOwner: 'o/r' } }, { number: 9, repository: { nameWithOwner: 'x/y' } }] },
    statusCheckRollup: { state: 'FAILURE', contexts: { nodes: [
      { __typename: 'CheckRun', conclusion: 'SUCCESS', status: 'COMPLETED', startedAt: null, completedAt: '2026-11-05T00:00:00Z' },
      { __typename: 'CheckRun', conclusion: 'FAILURE', status: 'COMPLETED', startedAt: null, completedAt: '2026-11-07T00:00:00Z' },
      { __typename: 'StatusContext', state: 'ERROR', createdAt: '2026-11-06T00:00:00Z' },
    ] } },
    timelineItems: { nodes: [
      { __typename: 'ReviewRequestedEvent', createdAt: '2026-11-02T00:00:00Z', requestedReviewer: { __typename: 'User', login: 'lin' } },
      { __typename: 'ReviewRequestedEvent', createdAt: '2026-11-04T00:00:00Z', requestedReviewer: { __typename: 'User', login: 'lin' } },
    ] },
  };

  it('maps a pull request to the rules engine shape', () => {
    const m = mapPullRequest('o/r', pr);
    expect(m.requested_reviewers).toEqual(['lin', '@core']);
    expect(m.checks).toBe('failing');
    expect(m.failing_check_count).toBe(2);
    expect(m.checks_failing_since).toBe('2026-11-06T00:00:00Z');
    expect(m.waiting_since).toBe('2026-11-04T00:00:00Z');
    expect(m.files_changed).toBe(4);
    expect(m.reviewed).toBe(false);
  });

  it('uses the latest changes-requested review as the wait start', () => {
    const m = mapPullRequest('o/r', { ...pr, reviewDecision: 'CHANGES_REQUESTED', statusCheckRollup: null,
      latestReviews: { nodes: [{ author: { login: 'lin' }, state: 'CHANGES_REQUESTED', submittedAt: '2026-11-08T00:00:00Z' }] } });
    expect(m.changes_requested_by).toBe('lin');
    expect(m.waiting_since).toBe('2026-11-08T00:00:00Z');
    expect(m.checks).toBe('none');
  });

  it('links only same-repository issues closed by an open pull request', () => {
    const issue = (n: number) => mapIssue('o/r', { number: n, title: 't', url: '', createdAt: '2026-11-01', updatedAt: '2026-11-01', assignees: { nodes: [] }, labels: null, milestone: null });
    const issues = [issue(3), issue(9)];
    linkIssues('o/r', issues, [pr]);
    expect(issues.map((i) => i.linked_open_pull_request)).toEqual([7, null]);
  });
});

describe('error translation', () => {
  it('recognises rate limits and revoked access', () => {
    expect(translate({ status: 403, response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000000000' } } })).toBeInstanceOf(RateLimited);
    expect(translate({ status: 429, response: { headers: { 'retry-after': '30' } } })).toBeInstanceOf(RateLimited);
    expect(translate({ status: 401 })).toBeInstanceOf(AccessRevoked);
  });
});

describe('the API', () => {
  it('serves the sample dashboard without sign-in', async () => {
    const res = await app.request('/api/sample/today');
    expect(res.status).toBe(200);
    expect((await res.json()).headline).toBe('Two things are blocking delivery.');
  });

  it('applies the viewer’s sample choices', async () => {
    const res = await app.request('/api/sample/repositories', { headers: { 'x-dirigo-sample': header({ watched: ['northwind/web-app'], settings: {} }) } });
    const body = await res.json();
    expect(body.rows.map((r: { name: string }) => r.name)).toEqual(['web-app']);
    const none = await app.request('/api/sample/today', { headers: { 'x-dirigo-sample': header({ watched: [], settings: {} }) } });
    expect((await none.json()).state).toBe('no_repositories');
  });

  it('ignores invalid sample settings', () => {
    expect(parseSampleState(header({ watched: null, settings: { review_target_days: -4 } })).settings).toEqual({});
    expect(parseSampleState(header({ watched: null, settings: { stalled_after_days: 7 } })).settings).toEqual({ stalled_after_days: 7 });
    expect(parseSampleState('not base64 json').watched).toBeNull();
  });

  it('refuses live data when GitHub is not configured', async () => {
    const res = await app.request('/api/today');
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('not_configured');
  });

  it('refuses state-changing requests without the CSRF header or from another origin', async () => {
    expect((await app.request('/api/settings', { method: 'PUT' })).status).toBe(403);
    expect((await app.request('/api/settings', { method: 'PUT', headers: { 'x-dirigo-csrf': '1', origin: 'https://evil.example' } })).status).toBe(403);
    expect((await app.request('/api/settings', { method: 'PUT', headers: { 'x-dirigo-csrf': '1' } })).status).toBe(503);
  });

  it('sends sign-in back to Connect with an explanation when it cannot start', async () => {
    const res = await app.request('/auth/github');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/connect?error=not_configured');
    const cancelled = await createApp(cfg, {} as never).request('/auth/github/callback?error=access_denied');
    expect(cancelled.headers.get('location')).toBe('/connect?error=cancelled');
  });

  it('sets security headers', async () => {
    const res = await app.request('/api/sample/me');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
