import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePaths, useToday } from '../data';
import {
  ArrowRight, BlockedIcon, GitHubLink, OkIcon, Page, PageHeader, Parts, ProgressBar, StatusIcon, WaitingIcon,
} from '../components';
import type { Bucket } from '../../shared/types';
import type { BlockedCard, BucketTab, DecisionRow, ShipBlock, TodayView } from '../../shared/views';
import { pick } from '../../shared/words';

const TONE: Record<Bucket, 'blocked' | 'waiting' | 'ok'> = { blocked: 'blocked', needs_your_decision: 'waiting', on_track: 'ok' };

function BucketButton({ b, selected, onSelect, quiet }: { b: BucketTab; selected: boolean; onSelect: () => void; quiet: boolean }) {
  const tone = TONE[b.key];
  const countClass = b.count === 0 ? '' : b.key === 'on_track' ? (b.emphasised ? 'c-ok' : '') : `c-${tone}`;
  const emph = b.emphasised ? ` emph-${tone}` : '';
  return (
    <button className={`bucket${emph}`} aria-pressed={selected} onClick={onSelect}
      aria-label={`${b.count} ${b.label.toLowerCase()}, ${b.caption}. ${selected ? 'Showing only these.' : 'Show only these.'}`}>
      <span className={`bucket-count ${countClass}`} aria-hidden="true">{b.count}</span>
      <span className="bucket-text" aria-hidden="true">
        <span className="bucket-label">{b.count > 0 || (quiet && b.emphasised) ? <StatusIcon tone={tone} /> : null}{b.label}</span>
        <span className="bucket-caption">{b.caption}</span>
      </span>
    </button>
  );
}

function Blocked({ card }: { card: BlockedCard }) {
  const path = usePaths();
  return (
    <article className="card blocked-card">
      <div className="blocked-top">
        <div className="blocked-title">
          <BlockedIcon size={22} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h3><span className="visually-hidden">Blocked: </span>{card.problem}</h3>
            <span className="sub">{card.item_line}</span>
          </div>
        </div>
        <Link className="chip" to={path(`/repositories/${card.repository.full_name}`)}>{card.repository.name}</Link>
      </div>
      <dl className="facts">
        {card.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
      </dl>
      <div className="actions">{card.links.map((l) => <GitHubLink key={l.label} link={l} />)}</div>
    </article>
  );
}

function Decision({ row }: { row: DecisionRow }) {
  return (
    <div className="decision">
      <WaitingIcon size={18} />
      <span className="decision-text">
        <span className="decision-title"><span className="visually-hidden">Waiting on you: </span>{row.title}</span>
        <span className="decision-context"><Parts parts={row.context} /></span>
      </span>
      <GitHubLink link={row.link} />
    </div>
  );
}

function Ship({ s }: { s: ShipBlock }) {
  const path = usePaths();
  const m = s.milestone;
  return (
    <Link className="ship" to={path(`/repositories/${s.repository.full_name}`)}>
      <span className="ship-top">
        <span className="ship-name"><StatusIcon tone={s.tone} />{s.repository.name}</span>
        <span className={`ship-status tone-${s.tone}`}>{s.label}</span>
      </span>
      {m ? (
        <>
          <span className="ship-line">{m.line}</span>
          <ProgressBar percent={m.percent} late={s.tone === 'blocked'} label={`${m.percent}% done`} />
          <span className="ship-summary"><span className="strong">{m.strong}</span> <span className="muted">{m.summary}</span></span>
        </>
      ) : (
        <span className="ship-line">No milestone with a due date</span>
      )}
    </Link>
  );
}

function NoRepositories({ v }: { v: TodayView }) {
  const path = usePaths();
  return (
    <>
      <div className="page-head" style={{ gap: 12, maxWidth: 640 }}>
        <span className="date-line">{v.date_line}</span>
        <h1 className="headline">{v.headline}</h1>
        <p className="lead">{v.lead}</p>
        <Link className="btn btn-primary btn-large" style={{ alignSelf: 'flex-start', marginTop: 8 }} to={path('/setup/repositories')}>Choose repositories<ArrowRight /></Link>
      </div>
      <div className="section">
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-muted)' }}>What this page will show once you do</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <div className="preview-outline"><span className="bucket-label"><BlockedIcon />Blocked</span><p>Stalled reviews and failing checks, with the milestone each one holds up.</p></div>
          <div className="preview-outline"><span className="bucket-label"><WaitingIcon />Needs your decision</span><p>Reviews you were asked for and changes requested on your work.</p></div>
          <div className="preview-outline"><span className="bucket-label"><OkIcon />On track</span><p>Everything moving without you, and whether each milestone will land on time.</p></div>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 15 }}>Not seeing a repository you expect? <Link className="strong" to="/connect">Check what Dirigo can access on GitHub</Link></p>
    </>
  );
}

export function Today() {
  const q = useToday();
  const path = usePaths();
  const [only, setOnly] = useState<Bucket | null>(null);

  return (
    <Page q={q}>
      {(v) => {
        if (v.state === 'no_repositories') return <NoRepositories v={v} />;
        if (v.state === 'syncing') {
          return (
            <div className="page-head" aria-busy="true" aria-live="polite">
              <span className="date-line">{v.date_line}</span>
              <h1 className="headline">Reading your repositories.</h1>
              <p className="lead">Dirigo is loading their issues and pull requests from GitHub. This page fills in by itself when it is done, usually within a minute.</p>
            </div>
          );
        }
        const quiet = v.state === 'nothing_blocked';
        const toggle = (k: Bucket) => setOnly((cur) => (cur === k ? null : k));
        const showBlocked = (only === null || only === 'blocked') && v.blocked.length > 0;
        const showDecisions = (only === null || only === 'needs_your_decision') && v.decisions.length > 0;
        const showOnTrack = only === 'on_track';
        return (
          <>
            <PageHeader date={v.date_line} title={v.headline} lead={v.lead} />
            <div className="buckets" role="group" aria-label="Filter by status">
              {v.buckets.map((b) => <BucketButton key={b.key} b={b} quiet={quiet} selected={only === b.key} onSelect={() => toggle(b.key)} />)}
            </div>

            {quiet ? (
              <>
                <section className="section" style={{ gap: 16 }}>
                  <h2 className="section-title">Will we ship on time?</h2>
                  <div className="ship-grid">{v.ship.map((s) => <Ship key={s.repository.full_name} s={s} />)}</div>
                </section>
                <Link className="text-link" style={{ alignSelf: 'flex-start', fontSize: 16 }} to={path('/work')}>See all open work</Link>
              </>
            ) : (
              <div className="today-cols">
                <div className="col-main">
                  {showBlocked && (
                    <>
                      <h2 className="section-title">Blocked</h2>
                      {v.blocked.map((c) => <Blocked key={c.key} card={c} />)}
                    </>
                  )}
                  {showDecisions && (
                    <>
                      <h2 className={`section-title${showBlocked ? ' gap-top' : ''}`}>Needs your decision</h2>
                      <div className="card rows">{v.decisions.map((d) => <Decision key={d.key} row={d} />)}</div>
                    </>
                  )}
                  {only === 'blocked' && v.blocked.length === 0 && <p className="card empty-note">Nothing is blocked.</p>}
                  {only === 'needs_your_decision' && v.decisions.length === 0 && <p className="card empty-note">Nothing is waiting on you.</p>}
                  {showOnTrack && (
                    <>
                      <h2 className="section-title">On track</h2>
                      <div className="card empty-note">
                        {v.on_track_count} {pick(v.on_track_count, 'item is', 'items are')} moving without you.{' '}
                        <Link className="strong" to={path('/work')}>See all open work</Link>
                      </div>
                    </>
                  )}
                </div>
                <div className="col-side">
                  <h2 className="section-title">Will we ship on time?</h2>
                  <div className="card rows">{v.ship.map((s) => <Ship key={s.repository.full_name} s={s} />)}</div>
                </div>
              </div>
            )}
          </>
        );
      }}
    </Page>
  );
}
