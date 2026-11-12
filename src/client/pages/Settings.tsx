import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActions, usePaths, useSample, useSettings } from '../data';
import { OkIcon, Page, PageHeader } from '../components';
import type { Settings } from '../../shared/types';
import type { SettingsView } from '../../shared/api';
import { plural } from '../../shared/dates';

function Rules({ v }: { v: SettingsView }) {
  const actions = useActions();
  const [draft, setDraft] = useState<Settings>(v.settings);
  const [status, setStatus] = useState<{ tone: 'ok' | 'blocked'; text: string } | null>(null);
  useEffect(() => setDraft(v.settings), [v.settings]);

  const valid = Number.isInteger(draft.review_target_days) && draft.review_target_days >= 1 && draft.review_target_days <= 30
    && Number.isInteger(draft.stalled_after_days) && draft.stalled_after_days >= 1 && draft.stalled_after_days <= 60;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setStatus({ tone: 'blocked', text: 'Use whole numbers: 1 to 30 days for reviews, 1 to 60 days for stalled work.' });
      return;
    }
    try {
      await actions.saveSettings(draft);
      setStatus({ tone: 'ok', text: 'Your rules are saved. Every screen now uses them.' });
    } catch (err) {
      setStatus({ tone: 'blocked', text: err instanceof Error ? err.message : 'Your rules could not be saved.' });
    }
  }

  const num = (k: 'review_target_days' | 'stalled_after_days') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [k]: e.target.value === '' ? NaN : Number(e.target.value) });

  return (
    <form className="card-lg panel" onSubmit={save} noValidate>
      <h2 className="section-title">Your rules</h2>
      <div className="rule">
        <label htmlFor="review-target">A review is late after</label>
        <input id="review-target" className="num-input" type="number" min={1} max={30} step={1} inputMode="numeric"
          value={Number.isNaN(draft.review_target_days) ? '' : draft.review_target_days} onChange={num('review_target_days')} aria-describedby="review-target-unit" />
        <span id="review-target-unit" className="muted">days without a first response</span>
      </div>
      <div className="rule">
        <label htmlFor="stall-after">Work is stalled after</label>
        <input id="stall-after" className="num-input" type="number" min={1} max={60} step={1} inputMode="numeric"
          value={Number.isNaN(draft.stalled_after_days) ? '' : draft.stalled_after_days} onChange={num('stalled_after_days')} aria-describedby="stall-after-unit" />
        <span id="stall-after-unit" className="muted">days without any activity</span>
      </div>
      <div className="rule col">
        <label htmlFor="in-progress-rule">An issue is in progress when</label>
        <select id="in-progress-rule" className="big-select" value={draft.in_progress_rule}
          onChange={(e) => setDraft({ ...draft, in_progress_rule: e.target.value as Settings['in_progress_rule'] })}>
          {v.in_progress_options.filter((o) => o.available).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="rule col">
        <label htmlFor="pace-window">Project landing dates from the pace of the last</label>
        <select id="pace-window" className="big-select" value={draft.pace_window_days}
          onChange={(e) => setDraft({ ...draft, pace_window_days: Number(e.target.value) })}>
          {v.pace_options.map((n) => <option key={n} value={n}>{n} days</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <button type="submit" className="btn btn-primary btn-form">Save rules</button>
        <span role="status" className={`form-status${status ? ` tone-${status.tone}` : ''}`}>{status?.text}</span>
      </div>
    </form>
  );
}

function Connection({ v }: { v: SettingsView }) {
  const sample = useSample();
  const actions = useActions();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sample) {
    return (
      <section className="card-lg panel" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 className="section-title">GitHub connection</h2>
          <span style={{ fontSize: 16 }}>Sample data. No GitHub account is connected.</span>
          <span className="muted" style={{ fontSize: 15 }}>Changes you make here stay in this browser.</span>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => actions.resetSample()}>Reset the sample</button>
          <Link className="btn btn-primary" to="/connect">Connect GitHub</Link>
        </div>
      </section>
    );
  }

  async function disconnect() {
    try {
      await actions.disconnect();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnecting failed.');
    }
  }

  return (
    <section className="card-lg panel" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 className="section-title">GitHub connection</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}><OkIcon size={18} />Connected as <span className="strong">{v.connection.login}</span></span>
        <span className="muted" style={{ fontSize: 15 }}>Read-only access to the {plural(v.connection.repositories, 'repository', 'repositories')} above.</span>
        {error && <span role="alert" className="tone-blocked">{error}</span>}
      </div>
      {confirming ? (
        <div className="actions" role="group" aria-label="Confirm disconnect">
          <span style={{ flexBasis: '100%', fontSize: 15 }}>This deletes your sign-in, your watched repositories and your rules from Dirigo.</span>
          <button className="btn btn-danger" onClick={disconnect}>Disconnect and delete</button>
          <button className="btn btn-secondary" onClick={() => setConfirming(false)}>Keep connected</button>
        </div>
      ) : (
        <div className="actions">
          <button className="btn btn-secondary" onClick={async () => { await actions.signOut(); navigate('/', { replace: true }); }}>Sign out</button>
          <button className="btn btn-danger" onClick={() => setConfirming(true)}>Disconnect GitHub</button>
        </div>
      )}
    </section>
  );
}

export function SettingsPage() {
  const q = useSettings();
  const path = usePaths();
  const actions = useActions();
  return (
    <Page q={q}>
      {(v) => (
        <div className="settings">
          <PageHeader title="Settings" lead="These rules decide what Dirigo calls late, stalled and in progress." />
          <Rules v={v} />
          <section className="card-lg panel" style={{ gap: 6 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px 16px', paddingBottom: 10 }}>
              <h2 className="section-title">Repositories you watch</h2>
              <Link className="text-link" style={{ fontSize: 16 }} to={path('/setup/repositories')}>Add repository</Link>
            </div>
            {v.watched.length === 0 && <p className="muted watch-row">You are not watching any repositories.</p>}
            {v.watched.map((w) => (
              <div key={w.full_name} className="watch-row">
                <span><span className="strong">{w.name}</span> <span className="muted">{w.owner}</span></span>
                <button className="btn btn-secondary" aria-label={`Stop watching ${w.name}`} onClick={() => actions.stopWatching(w.full_name)}>Stop watching</button>
              </div>
            ))}
          </section>
          <Connection v={v} />
        </div>
      )}
    </Page>
  );
}
