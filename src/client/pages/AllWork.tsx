import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePaths, useWork } from '../data';
import { BlockedIcon, GitHubLink, OkIcon, Page, PageHeader, Parts, StatusIcon, WaitingIcon } from '../components';
import type { QuickFilter, RowGrouping, WorkCard, WorkCell, WorkRow } from '../../shared/views';
import { plural } from '../../shared/dates';

const CELL_LIMIT = 3;

export function WorkCardView({ card, selected, onSelect, showRepo }: { card: WorkCard; selected: boolean; onSelect: () => void; showRepo: boolean }) {
  const tone = card.variant === 'blocked' ? 'blocked' : card.variant === 'waiting' ? 'waiting' : null;
  const metaTone = card.meta.length === 1 && card.meta[0].tone === 'ok' ? ' tone-ok' : '';
  return (
    <div className={`wcard-wrap${selected ? ' is-selected' : ''}`}>
      <button className={`wcard v-${card.variant}${selected ? ' is-selected' : ''}`} aria-expanded={selected} onClick={onSelect}>
        {card.label && (
          <span className={`wcard-label tone-${tone}`}>{tone === 'blocked' ? <BlockedIcon size={12} /> : <WaitingIcon size={12} />}{card.label}</span>
        )}
        <span className="wcard-title">{card.title}</span>
        <span className={`wcard-meta${metaTone}`}>
          {showRepo && `${card.repository.name} · `}
          <Parts parts={card.meta.map((p) => ({ ...p, tone: undefined, strong: metaTone ? false : p.strong }))} />
        </span>
      </button>
      {selected && (
        <div className="wcard-open" style={{ padding: card.variant === 'plain' || card.variant === 'ready' ? '6px 0 0' : undefined }}>
          <GitHubLink link={{ label: 'Open on GitHub', url: card.url, primary: true }} className="btn btn-primary btn-block" />
        </div>
      )}
    </div>
  );
}

function Cell({ cell, row, selected, onSelect, showRepo }: { cell: WorkCell; row: WorkRow; selected: string | null; onSelect: (k: string) => void; showRepo: boolean }) {
  const [open, setOpen] = useState(false);
  const total = cell.cards.length + cell.unlisted;
  if (total === 0) return <span className="cell cell-empty">{cell.empty_text}</span>;
  const visible = open ? cell.cards : cell.cards.slice(0, CELL_LIMIT);
  const more = total - visible.length - (open ? cell.unlisted : 0);
  return (
    <div className="cell">
      {visible.map((c) => <WorkCardView key={c.key} card={c} showRepo={showRepo} selected={selected === c.key} onSelect={() => onSelect(c.key)} />)}
      {!open && more > 0 && (
        <button className="cell-more" aria-expanded="false" aria-label={`Show ${more} more in ${row.title}`} onClick={() => setOpen(true)}>{more} more</button>
      )}
      {open && cell.unlisted > 0 && (
        <span className="cell-note">{plural(cell.unlisted, 'more issue')} {cell.unlisted === 1 ? 'is' : 'are'} counted but not listed in the sample data.</span>
      )}
      {open && (
        <button className="cell-more" aria-expanded="true" aria-label={`Show fewer in ${row.title}`} onClick={() => setOpen(false)}>Show fewer</button>
      )}
    </div>
  );
}

export function AllWork() {
  const [params, setParams] = useSearchParams();
  const path = usePaths();
  const query = {
    filter: (params.get('filter') ?? 'everything') as QuickFilter,
    rows: (params.get('rows') ?? 'repository') as RowGrouping,
    person: params.get('person') || null,
    label: params.get('label') || null,
  };
  const q = useWork(query);
  const [selected, setSelected] = useState<string | null>(null);

  // Built from the live address so two quick changes never overwrite each other.
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (!v || v === 'everything' || (k === 'rows' && v === 'repository')) next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <Page q={q} gap={24}>
      {(v) => (
        <>
          <PageHeader title="All work" lead={v.lead} />
          {v.empty_columns && (
            <div className="card notice" role="status">
              <OkIcon size={28} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="notice-title">{v.empty_columns.title}</span>
                <span className="notice-body">{v.empty_columns.body}</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div className="filters" role="group" aria-label="Quick filters">
              {v.filters.map((f) => (
                <button key={f.key} className={`qf qf-${f.key === 'waiting' ? 'waiting' : f.key === 'blocked' ? 'blocked' : 'plain'}`}
                  aria-pressed={query.filter === f.key} disabled={f.count === 0 && query.filter !== f.key}
                  onClick={() => set('filter', f.key)}>
                  {f.label} · {f.count}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div className="field">
                <label htmlFor="board-person">Person</label>
                <select id="board-person" className="select" value={query.person ?? ''} onChange={(e) => set('person', e.target.value)}>
                  {v.people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="board-label">Label</label>
                <select id="board-label" className="select" value={query.label ?? ''} onChange={(e) => set('label', e.target.value)}>
                  {v.labels.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="board-group">Rows</label>
                <select id="board-group" className="select" value={query.rows} onChange={(e) => set('rows', e.target.value)}>
                  <option value="repository">By repository</option>
                  <option value="person">By person</option>
                  <option value="milestone">By milestone</option>
                  <option value="none">No rows</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card-lg scroll-x" tabIndex={0} role="region" aria-label="Open work by stage">
            <div className="grid" role="table" aria-label="Open work by stage">
              <div role="row" style={{ display: 'contents' }}>
                <span role="columnheader" style={{ padding: '16px 16px 14px' }}><span className="visually-hidden">Row</span></span>
                {v.columns.map((c) => (
                  <div key={c.stage} role="columnheader" className={`grid-colhead${c.count === 0 ? ' is-empty' : ''}`}>
                    <span className="t"><span>{c.title}</span><span>{c.count}</span></span>
                    {c.count > 0 && <span className="d">{c.description}</span>}
                  </div>
                ))}
              </div>
              {v.rows.every((r) => r.open === 0) && (
                <div role="row" style={{ display: 'contents' }}>
                  <span role="cell" className="cell-empty" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--color-line)' }}>Nothing matches these filters.</span>
                </div>
              )}
              {v.rows.filter((r) => r.open > 0 || query.rows === 'repository').map((r) => (
                <div key={r.key} role="row" style={{ display: 'contents' }}>
                  <div role="rowheader" className="grid-rowhead">
                    <span className="t"><StatusIcon tone={r.tone} />{r.title}</span>
                    {r.subtitle && <span className="s">{r.subtitle}</span>}
                    <span className="s">{r.open ? `${r.open} open` : 'Nothing open'}</span>
                    {r.repository && <Link to={path(`/repositories/${r.repository}`)}>Open repository</Link>}
                  </div>
                  {r.cells.map((cell) => (
                    <div key={cell.stage} role="cell" style={{ display: 'contents' }}>
                      <Cell cell={cell} row={r} selected={selected} showRepo={query.rows !== 'repository'}
                        onSelect={(k) => setSelected((cur) => (cur === k ? null : k))} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
