import { Link } from 'react-router-dom';
import { useMilestones, usePaths } from '../data';
import { Page, PageHeader, StatusIcon } from '../components';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function Milestones() {
  const q = useMilestones();
  const path = usePaths();
  return (
    <Page q={q}>
      {(v) => (
        <>
          <PageHeader title={v.headline} lead={v.lead} />
          {v.rows.length === 0 ? (
            <p className="card empty-note">None of your repositories has an open milestone with a due date. <Link className="strong" to={path('/repositories')}>See your repositories</Link></p>
          ) : (
            <>
              <div className="legend" style={{ gap: '8px 28px' }}>
                <span><span aria-hidden="true" style={{ height: 22, borderLeft: '3px solid var(--color-ink)' }} />Due date</span>
                <span><span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-brand)' }} />Lands on or before the due date</span>
                <span><span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-blocked)' }} />Lands late, or only just</span>
                <span>The landing date assumes work continues at the pace of the last {v.pace_window} days.</span>
              </div>
              <div className="card-lg timeline">
                <div className="tl-axis" aria-hidden="true">
                  <span className="tl-left" />
                  <div className="tl-track">
                    <span style={{ left: 0 }}>{v.axis.start_label}</span>
                    {v.axis.marks.map((m) => <span key={m.label} style={{ left: pct(m.at), transform: 'translateX(-50%)' }}>{m.label}</span>)}
                  </div>
                  <span className="tl-note" />
                </div>
                {v.rows.map((r) => {
                  const late = r.tone === 'blocked';
                  return (
                    <div key={r.key} className="tl-row">
                      <div className="tl-left">
                        <StatusIcon tone={r.tone} size={20} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Link to={path(`/repositories/${r.repository.full_name}`)} className="tl-name" style={{ color: 'inherit', textDecoration: 'none' }}>{r.repository.name} · {r.title}</Link>
                          <span className="tl-dates">{r.dates}</span>
                          <span className={`tl-diff tone-${r.tone}`}>{r.difference_text}</span>
                        </div>
                      </div>
                      <div className="tl-track" role="img" aria-label={r.aria}>
                        <span className="tl-line" />
                        {v.axis.marks.map((m) => <span key={m.label} className="tl-month" style={{ left: pct(m.at) }} />)}
                        <span className={`tl-bar${late ? ' late' : ''}`} style={{ width: pct(r.bar_end) }} />
                        <span className="tl-due" style={{ left: pct(r.due_at) }} />
                        {r.landing_at !== null && <span className={`tl-dot${late ? ' late' : ''}`} style={{ left: pct(r.landing_at) }} />}
                      </div>
                      <div className="tl-note"><p><span className="strong" style={{ color: 'var(--color-ink)' }}>{r.strong}</span> {r.note}</p></div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}
