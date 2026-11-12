import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActions, useAvailable, usePaths, useSample } from '../data';
import { ArrowRight, ErrorState, Loading, Logo, Stepper } from '../components';
import { ago, plural } from '../../shared/dates';
import { Word, pick, word } from '../../shared/words';

export function ChooseRepositories() {
  const q = useAvailable();
  const path = usePaths();
  const sample = useSample();
  const navigate = useNavigate();
  const actions = useActions();
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [view, setView] = useState<'suggested' | 'all'>('suggested');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (q.data && ticked === null) setTicked(new Set(q.data.repositories.filter((r) => r.ticked).map((r) => r.full_name)));
  }, [q.data, ticked]);

  const data = q.data;
  const suggested = useMemo(() => data?.repositories.filter((r) => r.suggested) ?? [], [data]);
  const shown = useMemo(() => {
    const base = view === 'suggested' && !search ? suggested : data?.repositories ?? [];
    const s = search.trim().toLowerCase();
    return s ? base.filter((r) => r.full_name.toLowerCase().includes(s)) : base;
  }, [data, suggested, view, search]);

  const chosen = (data?.repositories ?? []).filter((r) => ticked?.has(r.full_name));
  const total = chosen.reduce((n, r) => n + r.open, 0);
  const now = new Date().toISOString();

  async function open() {
    setSaving(true);
    setFailure(null);
    try {
      await actions.setWatches(chosen.map((r) => r.full_name));
      navigate(path('/today'));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Your choice could not be saved.');
      setSaving(false);
    }
  }

  const toggle = (name: string) => setTicked((prev) => {
    const next = new Set(prev ?? []);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const initialTicked = data?.repositories.filter((r) => r.ticked).length ?? 0;

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="site-header">
        <Logo to={sample ? '/' : '/today'} />
        <Stepper step={2} />
      </header>
      {q.isLoading || !data ? (
        <main className="choose">{q.error ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Loading label="Finding your repositories" />}</main>
      ) : (
        <main className="choose">
          <section className="choose-main">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h1 className="headline" style={{ fontSize: 40, lineHeight: 1.08 }}>Which repositories do you answer for?</h1>
              <p className="lead" style={{ fontSize: 17, maxWidth: 600 }}>
                {data.active_count === 0
                  ? 'Dirigo found no repositories you have been active in over the last 90 days. Search for one below.'
                  : `You have been active in ${data.active_count} over the last 90 days. ${initialTicked ? `The ${initialTicked} you touched most ${pick(initialTicked, 'is', 'are')} already ticked.` : ''}`}
              </p>
              {sample && <p className="muted" style={{ fontSize: 14 }}>Sample data. Your choice is kept in this browser only.</p>}
              {data.no_installations && data.install_url && (
                <p className="card problem" style={{ fontSize: 15 }}>
                  <span>Dirigo is not installed on any of your accounts yet, so it can only read public repositories. <a className="strong" href={data.install_url}>Install Dirigo on GitHub</a></span>
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="repo-search" style={{ fontSize: 14, fontWeight: 600 }}>Search repositories</label>
                <input id="repo-search" className="search" type="search" placeholder="Name or organisation" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="segmented" role="group" aria-label="Which repositories to list">
                <button aria-pressed={view === 'suggested'} onClick={() => setView('suggested')}>Suggested · {suggested.length}</button>
                <button aria-pressed={view === 'all'} onClick={() => setView('all')}>All · {data.repositories.length}</button>
              </div>
            </div>

            <div className="card-lg pick-list">
              {shown.length === 0 && <p className="empty-note">No repositories match.</p>}
              {shown.map((r) => {
                const id = `r-${r.full_name.replace(/[^a-z0-9]/gi, '-')}`;
                const on = ticked?.has(r.full_name) ?? false;
                return (
                  <label key={r.full_name} htmlFor={id} className={`pick${on ? ' ticked' : ''}${r.available ? '' : ' unavailable'}`}>
                    <input id={id} type="checkbox" checked={on} disabled={!r.available} onChange={() => toggle(r.full_name)} />
                    <span className="nm"><span style={{ fontSize: 17, fontWeight: 600 }}>{r.name}</span><span className="muted" style={{ fontSize: 14 }}>{r.owner}</span></span>
                    <span className="role" style={{ fontWeight: r.role === 'Maintainer' ? 600 : 400 }}>{r.role}</span>
                    <span className="act">{r.last_active ? `Active ${ago(r.last_active, data.today, sample ? undefined : now)}` : 'No recent activity'}</span>
                    <span className="open">{r.open} open</span>
                    {!r.available && (
                      <span className="why">{r.unavailable_reason} {r.request_url && <a className="strong" href={r.request_url}>Ask an owner to approve Dirigo</a>}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>

          <aside className="card-lg choose-side" aria-label="Your choice">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="muted" style={{ fontSize: 14 }}>You are about to watch</span>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }} aria-live="polite">{plural(chosen.length, 'repository', 'repositories')}</span>
              <span className="muted" style={{ fontSize: 15 }}>{chosen.length ? `${total} open issues and pull requests between them` : 'Tick at least one to continue'}</span>
            </div>
            {chosen.length > 0 && (
              <ul className="summary-list">
                {chosen.map((r) => <li key={r.full_name}><span className="strong">{r.name}</span><span className="muted">{r.open}</span></li>)}
              </ul>
            )}
            {failure && <p role="alert" className="tone-blocked">{failure}</p>}
            <button className="btn btn-primary btn-xl btn-block" disabled={chosen.length === 0 || saving} onClick={open}>
              {saving ? 'Saving your choice' : 'Open my dashboard'}<ArrowRight />
            </button>
            <span className="muted" style={{ fontSize: 14 }}>You can add or remove repositories at any time.</span>
            <span className="visually-hidden">{Word(chosen.length)} chosen of {word(data.repositories.length)}.</span>
          </aside>
        </main>
      )}
    </div>
  );
}
