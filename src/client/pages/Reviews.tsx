import { useReviews } from '../data';
import { BlockedIcon, GitHubLink, Page, PageHeader, WaitingIcon } from '../components';
import type { ReviewRow } from '../../shared/views';

function WaitBar({ fill, tick, past, width }: { fill: number; tick: number; past: boolean; width?: number }) {
  return (
    <span className={`wait-bar${past ? ' past' : ''}`} aria-hidden="true" style={width ? { width } : undefined}>
      <span className="fill" style={{ width: `${fill * 100}%` }} />
      <span className="tick" style={{ left: `${tick * 100}%` }} />
    </span>
  );
}

function Row({ r, tick }: { r: ReviewRow; tick: number }) {
  return (
    <div className="review">
      <div className="review-text">
        <span className="review-title">
          {r.title}
          {r.holds_up && <span className="pill pill-blocked pill-small"><BlockedIcon size={12} />{r.holds_up}</span>}
        </span>
        <span className="review-context">{r.context}</span>
      </div>
      <span className="review-who">
        <span className="strong">{r.who}</span>
        {r.who_note && <><br /><span className="muted" style={{ fontSize: 14 }}>{r.who_note}</span></>}
      </span>
      <div className="review-wait">
        <WaitBar fill={r.fill} tick={tick} past={r.past_target} />
        <span className={`review-days${r.past_target ? ' tone-blocked' : ''}`}>
          {r.wait_label}<span className="visually-hidden">{r.past_target ? ', past your target' : ', within your target'}</span>
        </span>
      </div>
      <GitHubLink link={r.action} />
    </div>
  );
}

export function Reviews() {
  const q = useReviews();
  return (
    <Page q={q}>
      {(v) => (
        <>
          <PageHeader title={v.headline} lead={v.lead} />
          <div className="legend">
            <span><WaitBar fill={0.2} tick={v.tick} past={false} width={84} />Within target</span>
            <span><WaitBar fill={0.7} tick={v.tick} past width={84} />Past target</span>
            <span>The tick marks {v.target_days} {v.target_days === 1 ? 'day' : 'days'}. A full bar is one week.</span>
          </div>

          <section className="section">
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WaitingIcon size={18} />Waiting on you<span className="muted" style={{ fontWeight: 400 }}>{v.mine.length}</span>
            </h2>
            {v.mine.length ? (
              <div className="card rows" style={{ padding: '2px 22px' }}>{v.mine.map((r) => <Row key={r.key} r={r} tick={v.tick} />)}</div>
            ) : <p className="card empty-note">No review or revision is waiting on you.</p>}
          </section>

          <section className="section">
            <h2 className="section-title">Waiting on someone else <span className="muted" style={{ fontWeight: 400 }}>{v.others.length}</span></h2>
            {v.others.length ? (
              <div className="card rows" style={{ padding: '2px 22px' }}>{v.others.map((r) => <Row key={r.key} r={r} tick={v.tick} />)}</div>
            ) : <p className="card empty-note">No other pull request is waiting for a review.</p>}
          </section>

          <section className="section">
            <h2 className="section-title">Who is carrying the reviews</h2>
            {v.load.length ? (
              <div className="card load">
                {v.load.map((l) => (
                  <div key={l.name}>
                    <span className="muted" style={{ fontSize: 15 }}>{l.name}</span>
                    <span className="n">{l.waiting} waiting</span>
                    <span className={l.past_target ? 'tone-blocked strong' : 'muted'} style={{ fontSize: 14 }}>
                      {l.oldest_label}<span className="visually-hidden">{l.past_target ? ', past your target' : ''}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="card empty-note">Nobody has a review requested right now.</p>}
          </section>
        </>
      )}
    </Page>
  );
}
