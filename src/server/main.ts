import { serve } from '@hono/node-server';
import { createApp, type Live } from './app.js';
import { liveEnabled, loadConfig } from './config.js';
import { createPool, migrate } from './db/pool.js';
import { GitHubApp } from './github/client.js';
import { createJobs, startWorkers } from './jobs.js';
import { Store } from './store.js';

const cfg = loadConfig();
// `--port N` wins over PORT, so a dev runner that sets PORT for the client cannot clash.
const portFlag = process.argv.indexOf('--port');
if (portFlag > 0) cfg.port = Number(process.argv[portFlag + 1]);
let live: Live | null = null;

if (liveEnabled(cfg)) {
  const db = createPool(cfg.databaseUrl!);
  await migrate(db);
  const store = new Store(db, cfg.tokenKey!);
  const app = new GitHubApp(cfg.github!);
  const jobs = await createJobs(cfg);
  // Run workers in this process unless a separate worker is deployed.
  if (process.env.RUN_WORKERS !== 'false') await startWorkers(cfg, db, jobs, app, store);
  live = { store, app, jobs };
  console.log('GitHub sign-in is enabled.');
} else {
  console.log('GitHub sign-in is not configured; serving the sample dashboard only. See .env.example.');
}

serve({ fetch: createApp(cfg, live).fetch, port: cfg.port }, (info) => {
  console.log(`Dirigo is listening on http://localhost:${info.port}`);
});
