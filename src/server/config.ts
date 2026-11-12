// Configuration from the environment. The product name lives in one value (open question 3).

export const PRODUCT_NAME = process.env.PRODUCT_NAME ?? 'Dirigo';

export interface GitHubConfig {
  appId: string;
  appSlug: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  webhookSecret: string;
}

export interface Config {
  port: number;
  appUrl: string;
  production: boolean;
  databaseUrl: string | null;
  github: GitHubConfig | null;
  /** 32-byte key, base64, for encrypting tokens at rest. */
  tokenKey: Buffer | null;
  /** How often to re-read every watched repository. */
  reconcileCron: string;
  /** Days to keep a repository's data after its last watch is removed. */
  unwatchedGraceDays: number;
  /** Minutes an access check stays fresh. */
  accessCheckMinutes: number;
}

function key(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return buf;
}

function github(env: NodeJS.ProcessEnv): GitHubConfig | null {
  const appId = env.GITHUB_APP_ID;
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const privateKey = env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const webhookSecret = env.GITHUB_WEBHOOK_SECRET;
  const appSlug = env.GITHUB_APP_SLUG;
  if (!appId || !clientId || !clientSecret || !privateKey || !webhookSecret || !appSlug) return null;
  return { appId, appSlug, clientId, clientSecret, privateKey, webhookSecret };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8787),
    appUrl: (env.APP_URL ?? 'http://localhost:5180').replace(/\/$/, ''),
    production: env.NODE_ENV === 'production',
    databaseUrl: env.DATABASE_URL ?? null,
    github: github(env),
    tokenKey: key(env.TOKEN_ENCRYPTION_KEY),
    reconcileCron: env.RECONCILE_CRON ?? '*/15 * * * *',
    unwatchedGraceDays: Number(env.UNWATCHED_GRACE_DAYS ?? 7),
    accessCheckMinutes: Number(env.ACCESS_CHECK_MINUTES ?? 10),
  };
}

/** True when everything needed to sign in with GitHub and store data is configured. */
export function liveEnabled(c: Config): boolean {
  return !!(c.databaseUrl && c.github && c.tokenKey);
}
