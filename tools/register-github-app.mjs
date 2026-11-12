// Registers a development GitHub App with GitHub's manifest flow and writes its
// credentials to .env. You review the read-only permissions and press Create on GitHub.
//
// Usage: node tools/register-github-app.mjs [appUrl]
//   then open http://localhost:3999 in a browser where you are signed in to GitHub.
//
// Secrets are written to .env (git-ignored) and never printed.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const APP_URL = (process.argv[2] ?? 'http://localhost:5180').replace(/\/$/, '');
const PORT = 3999;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(APP_URL);
const state = randomBytes(16).toString('hex');

const manifest = {
  name: `Dirigo dev ${randomBytes(2).toString('hex')}`,
  url: APP_URL,
  description: 'Development instance of Dirigo. Read-only.',
  redirect_url: `http://localhost:${PORT}/callback`,
  callback_urls: [`${APP_URL}/auth/github/callback`],
  setup_url: `${APP_URL}/setup/repositories`,
  setup_on_update: true,
  public: false,
  // GitHub rejects webhook URLs it cannot reach, so a local app has no webhook or events.
  // Reconciliation keeps data current; add the webhook and events once the app has a public URL.
  ...(isLocal ? {} : {
    hook_attributes: { url: `${APP_URL}/api/webhooks/github`, active: true },
    default_events: [
      'issues', 'pull_request', 'pull_request_review', 'pull_request_review_comment', 'pull_request_review_thread',
      'check_run', 'check_suite', 'status', 'milestone', 'label',
    ],
  }),
  // Read-only, and nothing beyond what the Connect screen lists.
  default_permissions: {
    metadata: 'read',
    issues: 'read',
    pull_requests: 'read',
    checks: 'read',
    statuses: 'read',
  },
};

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function page(body) {
  return `<!doctype html><meta charset="utf-8"><title>Register Dirigo</title>
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 64px auto; padding: 0 16px; line-height: 1.5">${body}</body>`;
}

function writeEnv(app) {
  const lines = existsSync('.env') ? readFileSync('.env', 'utf8').split(/\r?\n/) : [];
  const values = {
    APP_URL,
    DATABASE_URL: 'postgres://dirigo:dirigo@localhost:5432/dirigo',
    GITHUB_APP_ID: String(app.id),
    GITHUB_APP_SLUG: app.slug,
    GITHUB_CLIENT_ID: app.client_id,
    GITHUB_CLIENT_SECRET: app.client_secret,
    GITHUB_PRIVATE_KEY: JSON.stringify(app.pem).slice(1, -1),
    GITHUB_WEBHOOK_SECRET: app.webhook_secret ?? randomBytes(20).toString('hex'),
    TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  };
  const kept = lines.filter((l) => l && !Object.keys(values).some((k) => l.startsWith(`${k}=`)));
  const out = [...kept, ...Object.entries(values).map(([k, v]) => `${k}=${k === 'GITHUB_PRIVATE_KEY' ? `"${v}"` : v}`)];
  writeFileSync('.env', out.join('\n') + '\n');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page(`
      <h1>Register a development GitHub App</h1>
      <p>GitHub will show you the app's permissions before anything is created. They are all read-only:
      metadata, issues, pull requests, checks and commit statuses.</p>
      <form action="https://github.com/settings/apps/new?state=${state}" method="post">
        <input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}">
        <button style="font-size: 18px; padding: 12px 20px">Continue to GitHub</button>
      </form>`));
    return;
  }
  if (url.pathname === '/callback') {
    if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
      res.writeHead(400, { 'content-type': 'text/html' });
      res.end(page('<h1>That did not come from this registration.</h1><p>Start again from the first page.</p>'));
      return;
    }
    const r = await fetch(`https://api.github.com/app-manifests/${url.searchParams.get('code')}/conversions`, {
      method: 'POST', headers: { accept: 'application/vnd.github+json' },
    });
    if (!r.ok) {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end(page(`<h1>GitHub did not finish the registration.</h1><p>Status ${r.status}. Start again.</p>`));
      return;
    }
    const app = await r.json();
    writeEnv(app);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page(`
      <h1>${escape(app.name)} is registered.</h1>
      <p>Its credentials are saved in <code>.env</code>. Next, install it on the account whose repositories you want Dirigo to read:</p>
      <p><a href="${escape(app.html_url)}/installations/new" style="font-size: 18px">Install ${escape(app.name)}</a></p>
      <p>You can close this tab afterwards.</p>`));
    console.log(`Registered ${app.slug} (app id ${app.id}). Credentials written to .env.`);
    setTimeout(() => process.exit(0), 500);
    return;
  }
  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`Open http://localhost:${PORT} in a browser where you are signed in to GitHub.`));
