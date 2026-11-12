import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Logo, NoIcon, OkIcon, Stepper } from '../components';

// The lists on this screen must stay true. If the GitHub App's permissions change, change them.
const CAN_READ = [
  'Issues and pull requests: titles, status, labels and assignees',
  'Review requests and who they are waiting on',
  'Whether automated checks pass or fail',
  'Milestones and their due dates',
];
const CANNOT = [
  'Read or copy your source code',
  'Merge, close, comment or change settings',
  'See repositories you do not choose in the next step',
];

const ERRORS: Record<string, string> = {
  cancelled: 'You cancelled on GitHub, so nothing was connected. You can try again whenever you are ready.',
  expired: 'The sign-in took too long or was started in another tab. Please try again.',
  failed: 'GitHub did not complete the sign-in. Please try again.',
  not_configured: 'Signing in with GitHub is not set up on this server yet. You can still look around the sample dashboard.',
};

export function Connect() {
  const [params] = useSearchParams();
  const error = params.get('error');
  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="site-header">
        <Logo to="/" />
        <Stepper step={1} />
      </header>
      <main className="connect">
        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h1 className="headline">Connect your GitHub account</h1>
          {error && ERRORS[error] && (
            <p role="alert" className="card problem" style={{ fontSize: 16 }}>{ERRORS[error]}</p>
          )}
          <p className="lead" style={{ maxWidth: 460 }}>You will go to GitHub to approve read-only access, then come straight back here to choose repositories.</p>
          <a className="btn btn-primary btn-xl" style={{ alignSelf: 'flex-start', marginTop: 8 }} href="/auth/github">
            Continue with GitHub<ArrowRight />
          </a>
          {error === 'not_configured' && <a className="text-link" href="/sample/today">See a sample dashboard</a>}
          {/* Open question 2: the access-token flow is not designed, so its link is hidden. */}
        </section>
        <section className="card-lg" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Dirigo can read</h2>
            <ul className="access-list">
              {CAN_READ.map((t) => <li key={t}><OkIcon size={20} />{t}</li>)}
            </ul>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 24, borderTop: '1px solid var(--color-line)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Dirigo cannot</h2>
            <ul className="access-list muted">
              {CANNOT.map((t) => <li key={t}><NoIcon />{t}</li>)}
            </ul>
          </div>
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>You can disconnect at any time from your GitHub settings.</p>
        </section>
      </main>
    </div>
  );
}
