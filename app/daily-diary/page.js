'use client';

import { useEffect, useRef, useState } from 'react';
import ui from '@/components/ui.module.scss';
import { teamFetch } from '@/components/team/client';
import { formatDueTime, todayInKolkata } from '@/lib/taskRules';
import styles from './diary.module.scss';

const EMPTY = { when: '', title: '', content: '' };

function prettyDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return value || '';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

function shortDate(value) {
  return prettyDate(value).replace(/^\w+,\s*/, '').replace(/\s+\d{4}$/, '');
}

function whenLabel(entry, full) {
  const date = full ? prettyDate(entry.date) : shortDate(entry.date);
  const time = formatDueTime(entry.time);
  if (!entry.time || time === 'End of day') return date;
  return `${date}, ${time}`;
}

export default function DailyDiaryPage() {
  const today = todayInKolkata();
  const formRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [ready, setReady] = useState(false);
  const [writing, setWriting] = useState(false);
  const [editing, setEditing] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState({ q: '', from: '', to: '', person: '' });
  const [scope, setScope] = useState('own');
  const [openId, setOpenId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState('');

  function load() {
    return teamFetch('/api/team/diary')
      .then((data) => {
        setEntries(data.entries || []);
        setScope(data.scope || 'own');
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setReady(true));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (writing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [writing, editing]);

  useEffect(() => {
    if (!openId) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setOpenId('');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  function openForm(entry) {
    setError('');
    setNotice('');
    setEditing(entry?.id || '');
    setForm({
      when: entry?.date ? `${entry.date}T${entry.time || '00:00'}` : '',
      title: entry?.title || '',
      content: entry?.content || '',
    });
    setWriting(true);
  }

  function startToday() {
    openForm();
  }

  function cancel() {
    setWriting(false);
    setEditing('');
    setForm(EMPTY);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = editing
        ? await teamFetch(`/api/team/diary/${editing}`, { method: 'PATCH', body: JSON.stringify(form) })
        : await teamFetch('/api/team/diary', { method: 'POST', body: JSON.stringify(form) });
      setNotice(saved.saved === 'updated' ? 'Note updated.' : 'Note saved.');
      cancel();
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  function closeNote() {
    setOpenId('');
    setConfirmDelete(false);
    setReason('');
  }

  async function remove(entry) {
    if (!reason.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await teamFetch(`/api/team/diary/${entry.id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
      if (editing === entry.id) cancel();
      closeNote();
      setNotice('Note moved to Deleted.');
      await load();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  const query = filters.q.trim().toLowerCase();
  const filtering = Boolean(query || filters.from || filters.to || filters.person);
  const people = [...new Set(entries.map((entry) => entry.authorName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const visible = entries.filter((entry) => {
    if (filters.person && entry.authorName !== filters.person) return false;
    if (filters.from && entry.date < filters.from) return false;
    if (filters.to && entry.date > filters.to) return false;
    if (!query) return true;
    return `${entry.authorName} ${entry.title} ${entry.content} ${entry.deleteReason}`.toLowerCase().includes(query);
  });
  const active = visible.filter((entry) => !entry.deleted);
  const removed = visible.filter((entry) => entry.deleted);
  const groups = [];
  active.forEach((entry) => {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) last.items.push(entry);
    else groups.push({ date: entry.date, items: [entry] });
  });
  const editingEntry = entries.find((entry) => entry.id === editing);
  const selected = entries.find((entry) => entry.id === openId);
  const activeTotal = entries.filter((entry) => !entry.deleted).length;
  const countLabel = filtering ? `${active.length} of ${activeTotal}` : `${activeTotal} ${activeTotal === 1 ? 'note' : 'notes'}`;

  function noteCard(entry) {
    return (
      <article key={entry.id} className={entry.deleted ? `${styles.entry} ${styles.deleted}` : styles.entry}>
        <button className={styles.cardBody} type="button" onClick={() => setOpenId(entry.id)}>
          <span className={styles.nameLine}>
            {scope !== 'own' ? <span className={styles.who}>{entry.authorName}{entry.own ? ' · You' : ''}</span> : null}
            <span className={styles.when}>{whenLabel(entry)}</span>
          </span>
          <span className={styles.taskLine}><strong>{entry.title}</strong></span>
          {entry.deleted || (scope === 'all' && entry.teamName) ? (
            <span className={styles.badges}>
              {entry.deleted ? <span className={styles.deletedBadge}>Deleted</span> : null}
              {scope === 'all' && entry.teamName ? <span className={styles.badge}>{entry.teamName}</span> : null}
            </span>
          ) : null}
          <span className={styles.note}>{entry.preview}</span>
          {entry.deleted && entry.deleteReason ? <span className={styles.note}>Reason: {entry.deleteReason}</span> : null}
        </button>
      </article>
    );
  }

  async function restore(entry) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await teamFetch(`/api/team/diary/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ restore: true }) });
      setOpenId('');
      setNotice('Note restored.');
      await load();
    } catch (restoreError) {
      setError(restoreError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1>Notes</h1>
          <p className={styles.today}>{prettyDate(today)}</p>
        </div>
        <button className={ui.primary} type="button" onClick={startToday}>+ Write Today&apos;s Note</button>
      </div>
      {error ? <p className={ui.alert}>{error}</p> : null}
      {notice ? <p className={ui.success}>{notice}</p> : null}
      {writing ? (
        <form ref={formRef} className={styles.panel} onSubmit={save}>
          <div className={styles.formHead}>
            <h2>{editing ? 'Edit note' : 'New note'}</h2>
            {editingEntry && !editingEntry.own ? <p>Updating {editingEntry.authorName}&apos;s note.</p> : null}
          </div>
          <div className={styles.form}>
            <div className={styles.split}>
              <label className={styles.field}>Date and time
                <input className={styles.control} type="datetime-local" min={`${today}T00:00`} value={form.when} onChange={(event) => setForm({ ...form, when: event.target.value })} required />
              </label>
              <label className={styles.field}>Title
                <input className={styles.control} value={form.title} placeholder="What was this day about?" onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={180} required />
              </label>
            </div>
            <label className={styles.field}>What did you do today?
              <textarea className={`${styles.control} ${styles.notes}`} value={form.content} placeholder="Write a few lines about the work you finished." onChange={(event) => setForm({ ...form, content: event.target.value })} required />
            </label>
            <div className={styles.actions}>
              <button className={ui.primary} type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save note'}</button>
              <button className={ui.ghost} type="button" onClick={cancel} disabled={busy}>Cancel</button>
            </div>
          </div>
        </form>
      ) : null}
      <section className={styles.list}>
        <div className={styles.listHead}>
          <h2>Note history</h2>
          <span>{ready ? countLabel : 'Loading...'}</span>
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>Search
            <input className={styles.control} value={filters.q} placeholder="Title or notes" onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
          </label>
          <label className={styles.field}>From
            <input className={styles.control} type="date" max={filters.to || today} value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          </label>
          <label className={styles.field}>To
            <input className={styles.control} type="date" min={filters.from || undefined} max={today} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </label>
          {scope !== 'own' ? (
            <label className={styles.field}>Person
              <select className={styles.control} value={filters.person} onChange={(event) => setFilters({ ...filters, person: event.target.value })}>
                <option value="">{scope === 'all' ? 'Everyone' : 'Everyone on this team'}</option>
                {people.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          ) : null}
          {filtering ? (
            <button className={styles.clear} type="button" onClick={() => setFilters({ q: '', from: '', to: '', person: '' })}>Clear</button>
          ) : null}
        </div>
        {groups.length ? groups.map((group) => (
          <div key={group.date} className={styles.group}>
            <h3 className={styles.groupDate}>{prettyDate(group.date)}</h3>
            <div className={styles.entries}>
              {group.items.map(noteCard)}
            </div>
          </div>
        )) : removed.length ? null : <p className={styles.empty}>{!ready ? 'Loading notes...' : filtering || activeTotal ? 'No notes match this filter.' : 'No notes yet. Write a few lines about what you did today.'}</p>}
        {removed.length ? (
          <div className={styles.deletedBlock}>
            <h2>Deleted</h2>
            <div className={styles.entries}>{removed.map(noteCard)}</div>
          </div>
        ) : null}
      </section>
      {selected ? (
        <div className={styles.modal} onClick={closeNote}>
          <div className={`${styles.dialog} ${styles.detailDialog}`} role="dialog" aria-modal="true" aria-labelledby="note-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.dialogTop}>
              <div className={styles.dialogTitle}>
                <p className={styles.dialogMeta}>
                  {whenLabel(selected, true)}
                  {selected.deleted ? ' · Deleted' : ''}
                  {scope !== 'own' ? ` · ${selected.authorName}${scope === 'all' && selected.teamName ? ` · ${selected.teamName}` : ''}` : ''}
                </p>
                <h2 id="note-title">{selected.title}</h2>
              </div>
              <button className={styles.close} type="button" aria-label="Close" onClick={closeNote}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className={styles.dialogScroll}>
              <p className={styles.dialogBody}>{selected.content}</p>
              {selected.deleted && selected.deleteReason ? <p className={styles.reasonLine}>Reason: {selected.deleteReason}</p> : null}
              {selected.canEdit && selected.deleted ? (
                <div className={styles.actions}>
                  <button className={ui.primary} type="button" disabled={busy} onClick={() => restore(selected)}>Restore</button>
                </div>
              ) : null}
              {selected.canEdit && !selected.deleted && confirmDelete ? (
                <form className={styles.confirmDelete} onSubmit={(event) => { event.preventDefault(); remove(selected); }}>
                  <label className={styles.field}>Why delete this note?
                    <textarea className={`${styles.control} ${styles.reason}`} value={reason} autoFocus maxLength={500} placeholder="Type the reason" onChange={(event) => setReason(event.target.value)} required />
                  </label>
                  <div className={styles.actions}>
                    <button className={ui.danger} type="submit" disabled={busy || !reason.trim()}>Delete</button>
                    <button className={ui.ghost} type="button" disabled={busy} onClick={() => { setConfirmDelete(false); setReason(''); }}>Cancel</button>
                  </div>
                </form>
              ) : null}
              {selected.canEdit && !selected.deleted && !confirmDelete ? (
                <div className={styles.actions}>
                  <button className={ui.ghost} type="button" onClick={() => { setOpenId(''); openForm(selected); }}>Edit</button>
                  <button className={ui.danger} type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
