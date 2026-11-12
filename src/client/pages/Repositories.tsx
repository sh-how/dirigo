import { Link } from 'react-router-dom';
import { usePaths, useRepositories } from '../data';
import { Chevron, Page, PageHeader, ProgressBar, StatusIcon } from '../components';
import { STAGES } from '../../shared/types';
import { STAGE_TITLES } from '../../shared/views';

const HEADINGS = ['Open issues', 'In progress', 'Needs review', 'Open PRs'];

export function Repositories() {
  const q = useRepositories();
  const path = usePaths();
  return (
    <Page q={q}>
      {(v) => (
        <>
          <PageHeader title={v.headline} lead={v.lead}>
            <Link className="btn btn-primary btn-form" to={path('/setup/repositories')}>Add repository</Link>
          </PageHeader>
          {v.rows.length === 0 ? (
            <p className="card empty-note">Add a repository to compare it here.</p>
          ) : (
            <>
              <div className="card-lg scroll-x" tabIndex={0} role="region" aria-label="Repositories compared">
                <div className="rtable" role="table" aria-label="Repositories compared">
                  <div role="row" style={{ display: 'contents' }}>
                    <span role="columnheader" className="h l">Repository</span>
                    {HEADINGS.map((h) => <span key={h} role="columnheader" className="h">{h}</span>)}
                    <span role="columnheader" className="h m">Next milestone</span>
                    <span role="columnheader"><span className="visually-hidden">Open</span></span>
                  </div>
                  {v.rows.map((r) => (
                    <div key={r.full_name} role="row" style={{ display: 'contents' }}>
                      <div role="rowheader" className="name">
                        <StatusIcon tone={r.tone} size={20} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="n">{r.name} <span className="o">{r.owner}</span></span>
                          <span className={`r${r.reason_tone === 'blocked' ? ' tone-blocked' : ''}`}>
                            <span className="visually-hidden">{r.status === 'on_track' ? 'On track. ' : r.status === 'behind' ? 'Behind. ' : 'At risk. '}</span>
                            {r.reason}
                          </span>
                        </div>
                      </div>
                      {STAGES.map((s) => {
                        const n = r.counts[s];
                        const stuck = r.stuck_stage === s;
                        return (
                          <span key={s} role="cell" className={`c${n === 0 ? ' zero' : ''}`} aria-label={`${STAGE_TITLES[s]}: ${n}${stuck ? ', stuck here' : ''}`}>
                            {stuck ? <span className="stuck">{n}</span> : n}
                          </span>
                        );
                      })}
                      <div role="cell" className="ms">
                        {r.milestone ? (
                          <>
                            <span className="t"><span className="strong">{r.milestone.label}</span><span className={`tone-${r.milestone.tone}`} style={{ fontWeight: r.milestone.tone === 'ok' ? 600 : 700 }}>{r.milestone.status_text}</span></span>
                            <ProgressBar thin percent={r.milestone.percent} late={r.milestone.tone === 'blocked'} label={`${r.milestone.percent}% done`} />
                          </>
                        ) : <span className="muted" style={{ fontSize: 14 }}>No milestone with a due date</span>}
                      </div>
                      <span role="cell" style={{ display: 'contents' }}><Link className="go" to={path(`/repositories/${r.full_name}`)} aria-label={`Open ${r.name}`}><Chevron /></Link></span>
                    </div>
                  ))}
                  <div role="row" style={{ display: 'contents' }}>
                    <span role="rowheader" className="tot l">{v.totals_label}</span>
                    {STAGES.map((s) => <span key={s} role="cell" className="tot">{v.totals[s]}</span>)}
                    <span role="cell" className="tot m">{v.total_open} open items</span>
                    <span role="cell" className="tot" />
                  </div>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>A filled red number marks the stage where a repository is stuck.</p>
            </>
          )}
        </>
      )}
    </Page>
  );
}
