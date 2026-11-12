import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { usePaths, useRepository } from '../data';
import { ArrowLeft, BlockedIcon, OkIcon, Page, Parts, Pill, ProgressBar, WaitingIcon } from '../components';
import type { WorkCard } from '../../shared/views';
import { plural } from '../../shared/dates';

const COLUMN_LIMIT = 3;

function BoardCard({ card }: { card: WorkCard }) {
  const tone = card.variant === 'blocked' ? 'blocked' : card.variant === 'waiting' ? 'waiting' : null;
  const ok = card.variant === 'ready';
  const Tag = card.url ? 'a' : 'div';
  const linkProps = card.url ? { href: card.url, target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <Tag className={`bcard v-${card.variant}`} {...linkProps}>
      {card.board_label && (
        <span className={`bcard-label tone-${tone}`}>{tone === 'blocked' ? <BlockedIcon size={14} /> : <WaitingIcon size={14} />}{card.board_label}</span>
      )}
      <span className="bcard-title">{card.title}{card.url && <span className="visually-hidden"> (opens GitHub in a new tab)</span>}</span>
      <span className="bcard-ref">
        <span className="bcard-number">{card.board_ref}</span>
        {card.board_tags.map((t) => <span key={t} className="tag">{t}</span>)}
      </span>
      {card.board_meta.length > 0 && (
        <span className={`bcard-meta${ok ? ' tone-ok' : ''}`}>{ok && <OkIcon size={14} />}<span><Parts parts={card.board_meta.map((p) => ({ ...p, tone: undefined, strong: ok ? false : p.strong }))} /></span></span>
      )}
    </Tag>
  );
}

function Column({ title, count, cards, unlisted }: { title: string; count: number; cards: WorkCard[]; unlisted: number }) {
  const [open, setOpen] = useState(false);
  const visible = open ? cards : cards.slice(0, COLUMN_LIMIT);
  const more = count - visible.length - (open ? unlisted : 0);
  return (
    <section className="board-col" aria-label={`${title}, ${count}`}>
      <div className="board-col-head"><h2>{title}</h2><span>{count}</span></div>
      {count === 0 && <span className="muted" style={{ fontSize: 14, padding: '0 4px 4px' }}>Nothing here</span>}
      {visible.map((c) => <BoardCard key={c.key} card={c} />)}
      {!open && more > 0 && <button className="cell-more" aria-expanded="false" style={{ fontSize: 14, padding: '10px 4px' }} onClick={() => setOpen(true)}>Show {more} more</button>}
      {open && unlisted > 0 && <span className="cell-note">{plural(unlisted, 'more issue')} {unlisted === 1 ? 'is' : 'are'} counted but not listed in the sample data.</span>}
      {open && <button className="cell-more" aria-expanded="true" style={{ fontSize: 14, padding: '10px 4px' }} onClick={() => setOpen(false)}>Show fewer</button>}
    </section>
  );
}

export function Repository() {
  const { owner = '', name = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? 'everything';
  const q = useRepository(`${owner}/${name}`, filter);
  const path = usePaths();
  return (
    <Page q={q} gap={24}>
      {(v) => (
        <>
          <Link className="back-link" to={path('/today')}><ArrowLeft />Back to Today</Link>
          <div className="repo-head">
            <div className="left">
              <div className="title-row">
                <h1 className="headline">{v.name}</h1>
                <Pill tone={v.tone}>{v.status_label}</Pill>
                {v.url && <a className="text-link" href={v.url} target="_blank" rel="noopener noreferrer">Open on GitHub<span className="visually-hidden"> (new tab)</span></a>}
              </div>
              <p className="lead">{v.sentence}</p>
            </div>
            {v.milestone ? (
              <div className="card ms-card">
                <span className="t"><span className="strong" style={{ fontWeight: 700 }}>{v.milestone.title}</span><span className="muted">{v.milestone.due_line}</span></span>
                <ProgressBar percent={v.milestone.percent} late={v.tone === 'blocked'} label={`${v.milestone.percent}% done`} />
                <span style={{ fontSize: 14 }}><span className="strong">{v.milestone.strong}</span> <span className="muted">{v.milestone.summary}</span></span>
              </div>
            ) : (
              <div className="card ms-card"><span className="muted">No milestone with a due date. Add one on GitHub to see whether it will land on time.</span></div>
            )}
          </div>
          <div className="filters" role="group" aria-label="Filter the board">
            {v.filters.map((f) => (
              <button key={f.key} className={`qf qf-${f.key}`} aria-pressed={filter === f.key} disabled={f.count === 0 && filter !== f.key}
                onClick={() => { const n = new URLSearchParams(window.location.search); if (f.key === 'everything') n.delete('filter'); else n.set('filter', f.key); setParams(n, { replace: true }); }}>
                {f.label} · {f.count}
              </button>
            ))}
          </div>
          <div className="board">
            {v.columns.map((c) => <Column key={`${c.stage}-${filter}`} title={c.title} count={c.count} cards={c.cards} unlisted={c.unlisted} />)}
          </div>
        </>
      )}
    </Page>
  );
}
