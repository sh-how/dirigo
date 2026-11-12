import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ApiFailure, useMe, usePaths, useSample } from './data';
import type { Link as ViewLink, TextPart, Tone } from '../shared/views';

// ---- Logo ---------------------------------------------------------------------------------

export function Logo({ to }: { to: string }) {
  return (
    <Link to={to} className="logo" aria-label="Dirigo home">
      <span className="logo-mark" aria-hidden="true" />
      <span className="logo-word">Dirigo</span>
    </Link>
  );
}

// ---- Status icons: each status has a shape, a colour and a word --------------------------

export function BlockedIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="icon" aria-hidden="true" width={size} height={size} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="8" fill="var(--color-blocked)" />
      <rect x="4" y="7" width="8" height="2" rx="1" fill="var(--color-on-status)" />
    </svg>
  );
}

export function WaitingIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="icon" aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="var(--color-waiting-icon)" strokeWidth="3" />
    </svg>
  );
}

export function OkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="icon" aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="var(--color-ok)" strokeWidth="1.5" />
      <path d="M5 8.2l2 2 4-4.4" stroke="var(--color-ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg className="icon" aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="7" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </svg>
  );
}

export function StatusIcon({ tone, size }: { tone: Tone | null; size?: number }) {
  if (tone === 'blocked') return <BlockedIcon size={size} />;
  if (tone === 'waiting') return <WaitingIcon size={size} />;
  if (tone === 'ok') return <OkIcon size={size} />;
  return null;
}

export function ArrowRight({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg className="icon" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h10M10 5l4 4-4 4" />
    </svg>
  );
}

export function ArrowLeft() {
  return (
    <svg className="icon" aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9H4M8 5L4 9l4 4" />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg className="icon" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4l5 5-5 5" />
    </svg>
  );
}

export function Pill({ tone, children, small }: { tone: Tone; children: ReactNode; small?: boolean }) {
  return (
    <span className={`pill pill-${tone === 'neutral' ? 'ok' : tone}${small ? ' pill-small' : ''}`}>
      <StatusIcon tone={tone} size={small ? 12 : 14} />
      {children}
    </span>
  );
}

export function ProgressBar({ percent, late, thin, label }: { percent: number; late: boolean; thin?: boolean; label: string }) {
  return (
    <span className={`bar${late ? ' bar-blocked' : ''}${thin ? ' bar-thin' : ''}`} role="img" aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

export function Parts({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={[p.strong ? 'em strong' : '', p.tone ? `tone-${p.tone}` : ''].join(' ').trim() || undefined}>{p.text}</span>
      ))}
    </>
  );
}

// ---- Links to GitHub ------------------------------------------------------------------------

/**
 * Every action is a link that opens GitHub. Sample data has no GitHub page, so its links
 * are shown but do nothing.
 */
export function GitHubLink({ link, className, style }: { link: ViewLink; className?: string; style?: React.CSSProperties }) {
  const cls = className ?? `btn ${link.primary ? 'btn-primary' : 'btn-secondary'}`;
  if (!link.url) {
    return (
      <a className={`${cls} inert-link`} style={style} role="link" aria-disabled="true" tabIndex={0}
        title="Sample data has no GitHub page" onClick={(e) => e.preventDefault()}>
        {link.label}<span className="visually-hidden"> (sample data, no GitHub page)</span>
      </a>
    );
  }
  return (
    <a className={cls} style={style} href={link.url} target="_blank" rel="noopener noreferrer">
      {link.label}<span className="visually-hidden"> (opens GitHub in a new tab)</span>
    </a>
  );
}

// ---- Page header ---------------------------------------------------------------------------

export function PageHeader({ date, title, lead, children }: { date?: string; title: string; lead?: string; children?: ReactNode }) {
  const head = (
    <div className="page-head">
      {date && <span className="date-line">{date}</span>}
      <h1 className="headline">{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
  if (!children) return head;
  return <div className="head-row">{head}{children}</div>;
}

// ---- App shell -----------------------------------------------------------------------------

const NAV = [
  { to: '/today', label: 'Today' },
  { to: '/work', label: 'All work' },
  { to: '/repositories', label: 'Repositories' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/milestones', label: 'Milestones' },
];

export function Shell({ children, gap }: { children: ReactNode; gap?: 24 }) {
  const path = usePaths();
  const sample = useSample();
  const me = useMe();
  const badge = me.data?.reviews_badge ?? 0;
  const lines = me.data?.sync_lines ?? [];
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar">
        <Logo to={path('/today')} />
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={path(n.to)} end={n.to !== '/repositories'}>
              {n.label}
              {n.to === '/reviews' && badge > 0 && (
                <span className="badge-waiting" aria-label={`${badge} waiting on you`}>{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>{lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}</span>
          <NavLink to={path('/settings')}>Settings</NavLink>
        </div>
      </aside>
      <main id="main" className={`main${gap ? ' gap-24' : ''}`}>
        {sample && <SampleBanner />}
        {me.data?.problems.map((p) => (
          <div key={`${p.code}-${p.repository}`} className="card problem" role="status">
            {p.code === 'rate_limited' || p.code === 'unreachable' ? <WaitingIcon size={18} /> : <BlockedIcon size={18} />}
            <span>{p.message}</span>
          </div>
        ))}
        {children}
      </main>
    </div>
  );
}

function SampleBanner() {
  return (
    <div className="sample-banner">
      <span>You are looking at sample data. Every name, number and date here is invented.</span>
      <Link className="text-link" to="/connect">Connect GitHub</Link>
    </div>
  );
}

// ---- Loading and errors ----------------------------------------------------------------------

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div className="skeleton" style={{ height: 52, maxWidth: 560 }} />
      <div className="skeleton" style={{ height: 24, maxWidth: 420 }} />
      <div className="skeleton" style={{ height: 180 }} />
    </div>
  );
}

export function ErrorState({ error, retry }: { error: ApiFailure | null; retry?: () => void }) {
  const code = error?.code ?? 'error';
  let title = 'This page could not be loaded.';
  let action: ReactNode = retry ? <button className="btn btn-secondary" onClick={retry}>Try again</button> : null;
  if (code === 'not_signed_in') {
    title = 'Sign in to see your dashboard.';
    action = <a className="btn btn-primary" href="/auth/github">Continue with GitHub</a>;
  } else if (code === 'access_revoked') {
    title = 'GitHub access was removed.';
    action = <a className="btn btn-primary" href="/auth/github">Connect GitHub again</a>;
  } else if (code === 'rate_limited') {
    title = 'GitHub has asked Dirigo to wait.';
  } else if (code === 'unreachable' || code === 'offline') {
    title = 'GitHub could not be reached.';
  } else if (code === 'not_configured') {
    title = 'Signing in with GitHub is not set up here yet.';
    action = <Link className="btn btn-primary" to="/sample/today">See the sample dashboard</Link>;
  } else if (code === 'not_found') {
    title = 'That page does not exist.';
  }
  return (
    <div className="page-head" role="alert">
      <h1 className="headline">{title}</h1>
      <p className="lead">{error?.message}</p>
      {action && <div className="actions" style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

/** Renders loading and error states, then the page. */
export function Page<T>({ q, children, gap }: { q: { data?: T; error: ApiFailure | null; isLoading: boolean; refetch: () => unknown }; children: (d: T) => ReactNode; gap?: 24 }) {
  return (
    <Shell gap={gap}>
      {q.isLoading ? <Loading /> : q.error && !q.data ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data ? children(q.data) : null}
    </Shell>
  );
}

// ---- Stepper ---------------------------------------------------------------------------------

export function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <ol className="stepper" aria-label="Setup progress">
      {step === 1 ? (
        <li className="current" aria-current="step"><span className="dot" aria-hidden="true">1</span>Connect</li>
      ) : (
        <li className="done">
          <span className="dot" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8.2l2.6 2.6L12 5" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>Connected
        </li>
      )}
      <li className="sep" aria-hidden="true" />
      <li className={step === 2 ? 'current' : 'todo'} aria-current={step === 2 ? 'step' : undefined}><span className="dot" aria-hidden="true">2</span>Choose repositories</li>
      <li className="sep" aria-hidden="true" />
      <li className="todo"><span className="dot" aria-hidden="true">3</span>Today</li>
    </ol>
  );
}
