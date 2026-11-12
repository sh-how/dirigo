// A separate worker process for sync, webhook and reconciliation jobs.
// Start the web process with RUN_WORKERS=false when running this.
import { liveEnabled, loadConfig } from './config.js';
import { createPool, migrate } from './db/pool.js';
import { GitHubApp } from './github/client.js';
import { createJobs, startWorkers } from './jobs.js';
import { Store } from './store.js';

const cfg = loadConfig();
if (!liveEnabled(cfg)) {
  console.error('The worker needs DATABASE_URL, the GitHub App settings and TOKEN_ENCRYPTION_KEY.');
  process.exit(1);
}
const db = createPool(cfg.databaseUrl!);
await migrate(db);
const jobs = await createJobs(cfg);
await startWorkers(cfg, db, jobs, new GitHubApp(cfg.github!), new Store(db, cfg.tokenKey!));
console.log('Dirigo worker started.');
