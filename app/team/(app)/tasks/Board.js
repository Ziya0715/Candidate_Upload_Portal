'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ui from '@/components/ui.module.scss';
import { PRIORITY_LABELS, STATUS_LABELS, teamFetch } from '@/components/team/client';
import { formatDueDate, formatDueTime, nowInKolkata, todayInKolkata } from '@/lib/taskRules';
import styles from '@/components/team/team.module.scss';

const COLUMNS = [
  { id: 'todo', label: 'To Do', statuses: ['todo'] },
  { id: 'pending', label: 'Pending', statuses: ['pending'] },
  { id: 'hold', label: 'Hold/delete', statuses: ['hold', 'deleted'] },
  { id: 'completed', label: 'Completed', statuses: ['completed'] },
];
const MOVES = [
  { id: 'todo', label: 'To Do' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PAGE_SIZE = 5;
const EMPTY = { title: '', description: '', teamId: '', assignedTo: '', priority: 'medium', startDate: '', dueDate: '', dueTime: '', comment: '' };

function openDate(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && text >= todayInKolkata() ? text : '';
}

function openTime(date, time) {
  const clock = String(time || '').slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(clock)) return '';
  if (date === todayInKolkata() && clock <= nowInKolkata()) return '';
  return clock;
}

function dueLabel(task) {
  const date = String(task.dueDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const time = String(task.dueTime || '').slice(0, 5);
  return time ? `${formatDueDate(date)}, ${formatDueTime(time)}` : formatDueDate(date);
}

function dueValue(date, time) {
  const day = String(date || '').slice(0, 10);
  const clock = String(time || '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(clock)) return '';
  return `${day}T${clock}`;
}

function applyDue(current, value) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(value || ''));
  const dueDate = match ? match[1] : '';
  const dueTime = match ? match[2] : '';
  const startDate = dueDate && current.startDate && dueDate < current.startDate ? dueDate : current.startDate;
  return { ...current, dueDate, dueTime, startDate };
}

function RefreshButton({ label, busy, onClick }) {
  return (
    <button className={`${styles.refresh} ${busy ? styles.refreshing : ''}`} type="button" aria-label={`Refresh ${label}`} disabled={busy} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-2.6-6.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M21 3v6h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function dueMin() {
  return `${todayInKolkata()}T00:00`;
}

function canMove(task, moveId) {
  if (moveId === task.status) return false;
  if (task.status === 'completed' && (moveId === 'todo' || moveId === 'pending')) return false;
  if (task.status === 'pending' && moveId === 'todo') return false;
  return true;
}

function CardMenu({ task, busy, onMove, onAsk, onEdit, onSchedule }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const items = [];
  if (task.access !== 'view' && task.access !== 'none') {
    if (task.status !== 'deleted') items.push({ label: 'Edit', run: () => onEdit(task) });
    if (task.status !== 'completed' && task.status !== 'deleted') items.push({ label: 'Reschedule', run: () => onSchedule(task) });
    if (task.status === 'completed') items.push({ label: 'Reopen', run: () => onAsk(task, 'todo', 'reopen') });
    MOVES.forEach((move) => {
      if (!canMove(task, move.id)) return;
      items.push({ label: move.label, run: () => onMove(task, { status: move.id }) });
    });
    if (task.status !== 'hold') items.push({ label: 'Hold', run: () => onAsk(task, 'hold') });
    if (task.status !== 'deleted') items.push({ label: 'Delete', danger: true, run: () => onAsk(task, 'deleted') });
  }

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div className={styles.menuWrap} ref={menuRef}>
      <button className={styles.kebab} type="button" aria-label="Task actions" aria-expanded={open} aria-haspopup="menu" disabled={busy} onClick={() => setOpen((value) => !value)}>⋮</button>
      {open ? (
        <div className={styles.menu} role="menu">
          {items.map((item) => (
            <button key={item.label} className={item.danger ? `${styles.menuItem} ${styles.menuDanger}` : styles.menuItem} type="button" role="menuitem" onClick={() => { setOpen(false); item.run(); }}>{item.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Board({ actor, mine }) {
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [pages, setPages] = useState({});
  const [filters, setFilters] = useState({ q: '', status: '', priority: '', teamId: '', assigneeId: '', due: '', sort: 'created' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [editor, setEditor] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [editUsers, setEditUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (mine) params.set('mine', '1');
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return teamFetch(`/api/team/tasks?${params.toString()}`)
      .then((data) => setTasks(data.tasks || []))
      .catch((loadError) => setError(loadError.message));
  }

  function refresh() {
    setRefreshing(true);
    setPages({});
    load().finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [mine, filters.q, filters.status, filters.priority, filters.teamId, filters.assigneeId, filters.due, filters.sort]);
  useEffect(() => { setPages({}); }, [mine, filters.q, filters.status, filters.priority, filters.teamId, filters.assigneeId, filters.due, filters.sort]);
  useEffect(() => {
    teamFetch('/api/team/teams').then((data) => setTeams(data.teams || [])).catch(() => {});
    if (actor.teamId) setForm((current) => ({ ...current, teamId: current.teamId || actor.teamId }));
  }, [actor.teamId]);
  useEffect(() => {
    if (actor.role === 'team_member' || !form.teamId) return;
    teamFetch(`/api/team/users?assignable=1&teamId=${form.teamId}`).then((data) => setUsers(data.users || [])).catch(() => setUsers([]));
  }, [actor.role, form.teamId]);
  useEffect(() => {
    if (actor.role === 'team_member') {
      setAssignees([]);
      return;
    }
    const teamId = actor.role === 'super_admin' ? filters.teamId : actor.teamId;
    if (!teamId) {
      setAssignees([]);
      return;
    }
    teamFetch(`/api/team/users?assignable=1&teamId=${teamId}`).then((data) => setAssignees(data.users || [])).catch(() => setAssignees([]));
  }, [actor.role, actor.teamId, filters.teamId]);
  useEffect(() => {
    if (!editor || actor.role === 'team_member' || !editor.teamId) {
      setEditUsers([]);
      return;
    }
    teamFetch(`/api/team/users?assignable=1&teamId=${editor.teamId}`).then((data) => setEditUsers(data.users || [])).catch(() => setEditUsers([]));
  }, [actor.role, editor?.teamId]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await teamFetch('/api/team/tasks', { method: 'POST', body: JSON.stringify(form) });
      setCreating(false);
      setForm(EMPTY);
      setNotice('Task created.');
      load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function open(id) {
    setError('');
    try {
      setDetail(await teamFetch(`/api/team/tasks/${id}`));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function saveTask(id, patch) {
    setBusy(true);
    setError('');
    try {
      const updated = await teamFetch(`/api/team/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      if (detail?.task?.id === id) setDetail(updated);
      setNotice('Task updated.');
      load();
      return true;
    } catch (saveError) {
      setError(saveError.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openEditor(task) {
    setEditor({
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      teamId: task.teamId || '',
      assignedTo: task.assignedTo || '',
      startDate: String(task.startDate || '').slice(0, 10),
      dueDate: String(task.dueDate || '').slice(0, 10),
      dueTime: String(task.dueTime || '').slice(0, 5),
    });
  }

  function openSchedule(task) {
    const dueDate = openDate(task.dueDate);
    setSchedule({
      id: task.id,
      title: task.title || '',
      startDate: openDate(task.startDate),
      dueDate,
      dueTime: openTime(dueDate, task.dueTime),
      reason: '',
    });
  }

  async function submitEdit(event) {
    event.preventDefault();
    const patch = {
      title: editor.title,
      description: editor.description,
      priority: editor.priority,
    };
    if (actor.role !== 'team_member') {
      patch.teamId = editor.teamId;
      patch.assignedTo = editor.assignedTo;
    }
    if (await saveTask(editor.id, patch)) setEditor(null);
  }

  async function submitSchedule(event) {
    event.preventDefault();
    const saved = await saveTask(schedule.id, {
      reschedule: true,
      startDate: schedule.startDate,
      dueDate: schedule.dueDate,
      dueTime: schedule.dueTime,
      rescheduleReason: schedule.reason,
    });
    if (saved) setSchedule(null);
  }

  function ask(task, status, kind) {
    setPrompt({
      id: task.id,
      status: kind === 'reopen' ? 'todo' : status,
      kind: kind || status,
      reason: '',
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      startDate: openDate(task.startDate),
      dueDate: openDate(task.dueDate),
      dueTime: openTime(openDate(task.dueDate), task.dueTime),
    });
  }

  async function submitReason(event) {
    event.preventDefault();
    const patch = prompt.kind === 'reopen'
      ? {
          status: 'todo',
          reopenReason: prompt.reason,
          title: prompt.title,
          description: prompt.description,
          priority: prompt.priority,
          startDate: prompt.startDate,
          dueDate: prompt.dueDate,
          dueTime: prompt.dueTime,
        }
      : prompt.status === 'hold'
        ? { status: 'hold', holdReason: prompt.reason }
        : { status: 'deleted', deleteReason: prompt.reason };
    if (await saveTask(prompt.id, patch)) setPrompt(null);
  }

  const canCreate = actor.role === 'super_admin' || actor.role === 'team_leader' || actor.canCreateTasks;

  return (
    <>
      <div className={styles.top}>
        <div>
          <h1>{mine ? 'My Tasks' : 'Work Flow'}</h1>
          <p className={styles.muted}>Search and filter from the bar, then move a card between the columns.</p>
        </div>
        <div className={styles.row}>
          {actor.role === 'super_admin' ? <Link href="/team/teams">Manage work flows</Link> : null}
          {canCreate ? <button className={ui.primary} type="button" onClick={() => setCreating(true)}>New task</button> : null}
        </div>
      </div>
      <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label className={styles.field}>Search
          <input className={styles.control} placeholder="Title or task ID" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        </label>
        <label className={styles.field}>Status
          <select className={styles.control} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All</option>
            <option value="todo">To Do</option>
            <option value="pending">Pending</option>
            <option value="hold_delete">Hold/delete</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className={styles.field}>Priority
          <select className={styles.control} value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
            <option value="">All</option>
            {PRIORITIES.map((item) => <option key={item} value={item}>{PRIORITY_LABELS[item]}</option>)}
          </select>
        </label>
        {actor.role === 'super_admin' ? (
          <label className={styles.field}>Work Flow
            <select className={styles.control} value={filters.teamId} onChange={(event) => setFilters({ ...filters, teamId: event.target.value, assigneeId: '' })}>
              <option value="">All teams</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        ) : null}
        {actor.role !== 'team_member' && assignees.length ? (
          <label className={styles.field}>Assignee
            <select className={styles.control} value={filters.assigneeId} onChange={(event) => setFilters({ ...filters, assigneeId: event.target.value })}>
              <option value="">{actor.role === 'super_admin' && !filters.teamId ? 'Choose a team first' : 'Everyone on this team'}</option>
              {assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className={styles.field}>Due
          <select className={styles.control} value={filters.due} onChange={(event) => setFilters({ ...filters, due: event.target.value })}>
            <option value="">Any date</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <label className={styles.field}>Sort
          <select className={styles.control} value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option value="created">Newest</option>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </label>
      </form>
      {error ? <p className={ui.alert}>{error}</p> : null}
      {notice ? <p>{notice}</p> : null}
      <div className={styles.boardWrap}>
        <div className={styles.board}>
          {COLUMNS.map((column) => {
            const cards = tasks.filter((task) => column.statuses.includes(task.status));
            const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
            const page = Math.min(pages[column.id] || 1, pageCount);
            const pageCards = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            const tone = column.id === 'hold' ? styles.columnHold : column.id === 'pending' ? styles.columnPending : column.id === 'completed' ? styles.columnDone : '';
            return (
              <section key={column.id} className={`${styles.column} ${tone}`}>
                <div className={styles.columnHead}>
                  <h2>{column.label}</h2>
                  <span className={styles.columnTools}>
                    <RefreshButton label={column.label} busy={refreshing} onClick={refresh} />
                    <span className={styles.badge}>{cards.length}</span>
                  </span>
                </div>
                {pageCards.length ? pageCards.map((task) => {
                  const note = task.status === 'deleted' ? task.deleteReason : task.status === 'hold' ? task.holdReason : task.status === 'todo' ? task.reopenReason : '';
                  return (
                    <article key={task.id} className={`${styles.task} ${styles[`pri${task.priority[0].toUpperCase()}${task.priority.slice(1)}`] || ''} ${task.overdue ? styles.overdue : ''}`}>
                      <button className={styles.taskBody} type="button" onClick={() => open(task.id)}>
                        {actor.role === 'team_member' ? null : <span className={styles.who}>{task.assigneeName}</span>}
                        <span className={styles.taskLine}>
                          <strong>{task.title}</strong>
                          <span className={styles.when}>{dueLabel(task) || 'No date'}</span>
                        </span>
                        <span className={styles.badges}>
                          <span className={`${styles.badge} ${task.priority === 'high' || task.priority === 'urgent' ? styles.high : ''}`}>{PRIORITY_LABELS[task.priority]}</span>
                          {task.status === 'hold' || task.status === 'deleted' ? <span className={styles.badge}>{STATUS_LABELS[task.status]}</span> : null}
                          {task.overdue ? <span className={`${styles.badge} ${styles.high}`}>Overdue</span> : null}
                        </span>
                        {note ? <span className={styles.note}>{note}</span> : null}
                      </button>
                      <CardMenu
                        task={task}
                        busy={busy}
                        onMove={(item, patch) => saveTask(item.id, patch)}
                        onAsk={ask}
                        onEdit={openEditor}
                        onSchedule={openSchedule}
                      />
                    </article>
                  );
                }) : <p className={styles.muted}>No tasks</p>}
                {cards.length > PAGE_SIZE ? (
                  <div className={styles.pager}>
                    <button type="button" disabled={page <= 1} onClick={() => setPages((current) => ({ ...current, [column.id]: page - 1 }))}>Previous</button>
                    <span>{page} / {pageCount}</span>
                    <button type="button" disabled={page >= pageCount} onClick={() => setPages((current) => ({ ...current, [column.id]: page + 1 }))}>Next</button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
      {creating ? (
        <div className={styles.modal}>
          <form className={styles.dialog} onSubmit={create}>
            <h2>New task</h2>
            <div className={styles.form}>
              <label className={styles.field}>Title<input className={styles.control} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
              {actor.role === 'team_member' ? null : (
                <>
                  <label className={styles.field}>Work Flow
                    <select className={styles.control} value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value, assignedTo: '' })} required>
                      <option value="">Choose</option>
                      {teams.filter((team) => team.is_active && (actor.role === 'super_admin' || team.id === actor.teamId)).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>Assignee
                    <select className={styles.control} value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} required>
                      <option value="">Choose</option>
                      {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </label>
                </>
              )}
              <label className={styles.field}>Priority
                <select className={styles.control} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                  {PRIORITIES.map((item) => <option key={item} value={item}>{PRIORITY_LABELS[item]}</option>)}
                </select>
              </label>
              <label className={styles.field}>Start<input className={styles.control} type="date" min={todayInKolkata()} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
              <label className={`${styles.field} ${styles.dueField}`}>Due<input className={styles.control} type="datetime-local" min={dueMin()} value={dueValue(form.dueDate, form.dueTime)} onChange={(event) => setForm(applyDue(form, event.target.value))} /></label>
              <label className={`${styles.field} ${styles.wide}`}>Description<textarea className={styles.control} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label className={`${styles.field} ${styles.wide}`}>Comment<textarea className={styles.control} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label>
            </div>
            <div className={styles.row}>
              <button className={ui.primary} type="submit" disabled={busy}>{busy ? 'Saving...' : 'Create task'}</button>
              <button className={ui.ghost} type="button" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
      {detail ? (
        <div className={styles.modal}>
          <div className={styles.dialog}>
            <div className={styles.top}><h2>{detail.task.title}</h2><button className={ui.ghost} type="button" onClick={() => setDetail(null)}>Close</button></div>
            <p>{actor.role === 'team_member' ? detail.task.teamName : `${detail.task.teamName} · ${detail.task.assigneeName}`} · {PRIORITY_LABELS[detail.task.priority]} · {STATUS_LABELS[detail.task.status]}{detail.task.overdue ? ' · Overdue' : ''}</p>
            <p>{detail.task.description || 'No description.'}</p>
            <p className={styles.muted}>Due {dueLabel(detail.task) || 'not set'}{detail.task.completedAt ? ` · Completed ${detail.task.completedAt}` : ''}</p>
            {detail.task.holdReason ? <p>Hold reason: {detail.task.holdReason}</p> : null}
            {detail.task.deleteReason ? <p>Delete reason: {detail.task.deleteReason}</p> : null}
            {detail.task.reopenReason ? <p>Reopen reason: {detail.task.reopenReason}</p> : null}
            {detail.task.access !== 'view' ? (
              <div className={styles.row}>
                {detail.task.status !== 'deleted' ? (
                  <button className={ui.ghost} type="button" disabled={busy} onClick={() => openEditor(detail.task)}>Edit</button>
                ) : null}
                {detail.task.status !== 'completed' && detail.task.status !== 'deleted' ? (
                  <button className={ui.ghost} type="button" disabled={busy} onClick={() => openSchedule(detail.task)}>Reschedule</button>
                ) : null}
                {detail.task.status === 'completed' ? (
                  <button className={ui.ghost} type="button" disabled={busy} onClick={() => ask(detail.task, 'todo', 'reopen')}>Reopen</button>
                ) : null}
                {MOVES.filter((item) => canMove(detail.task, item.id)).map((item) => (
                  <button key={item.id} className={ui.ghost} type="button" disabled={busy} onClick={() => saveTask(detail.task.id, { status: item.id })}>Move to {item.label}</button>
                ))}
                {detail.task.status !== 'hold' ? (
                  <button className={ui.ghost} type="button" disabled={busy} onClick={() => ask(detail.task, 'hold')}>Hold</button>
                ) : null}
                {detail.task.status !== 'deleted' ? (
                  <button className={ui.danger} type="button" disabled={busy} onClick={() => ask(detail.task, 'deleted')}>Delete</button>
                ) : null}
              </div>
            ) : null}
            <h3>Comments</h3>
            {detail.comments.map((comment) => <p key={comment.id}><strong>{comment.user_name}: </strong>{comment.comment}</p>)}
            <form className={styles.row} onSubmit={(event) => {
              event.preventDefault();
              const comment = new FormData(event.target).get('comment');
              setBusy(true);
              teamFetch(`/api/team/tasks/${detail.task.id}/comments`, { method: 'POST', body: JSON.stringify({ comment }) })
                .then(setDetail)
                .catch((saveError) => setError(saveError.message))
                .finally(() => setBusy(false));
              event.target.reset();
            }}>
              <input className={styles.control} name="comment" placeholder="Add a comment" required />
              <button className={ui.primary} type="submit" disabled={busy}>Add</button>
            </form>
            <h3>Activity</h3>
            {detail.activity.map((item) => <p key={item.id} className={styles.muted}>{item.user_name || 'System'} {item.action} {item.old_value} → {item.new_value}</p>)}
          </div>
        </div>
      ) : null}
      {editor ? (
        <div className={styles.modal}>
          <form className={styles.dialog} onSubmit={submitEdit}>
            <h2>Edit task</h2>
            <div className={styles.form}>
              <label className={styles.field}>Title
                <input className={styles.control} value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required />
              </label>
              {actor.role === 'team_member' ? null : (
                <>
                  <label className={styles.field}>Work Flow
                    <select className={styles.control} value={editor.teamId} onChange={(event) => setEditor({ ...editor, teamId: event.target.value, assignedTo: '' })} required>
                      <option value="">Choose</option>
                      {teams.filter((team) => team.is_active && (actor.role === 'super_admin' || team.id === actor.teamId)).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>Assignee
                    <select className={styles.control} value={editor.assignedTo} onChange={(event) => setEditor({ ...editor, assignedTo: event.target.value })} required>
                      <option value="">Choose</option>
                      {editUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </label>
                </>
              )}
              <label className={styles.field}>Priority
                <select className={styles.control} value={editor.priority} onChange={(event) => setEditor({ ...editor, priority: event.target.value })}>
                  {PRIORITIES.map((item) => <option key={item} value={item}>{PRIORITY_LABELS[item]}</option>)}
                </select>
              </label>
              <label className={styles.field}>Start
                <input className={styles.control} type="date" value={editor.startDate} disabled />
              </label>
              <label className={`${styles.field} ${styles.dueField}`}>Due
                <input className={styles.control} type="datetime-local" value={dueValue(editor.dueDate, editor.dueTime)} disabled />
              </label>
              <label className={`${styles.field} ${styles.wide}`}>Description
                <textarea className={styles.control} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} />
              </label>
            </div>
            <div className={styles.row}>
              <button className={ui.primary} type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save task'}</button>
              <button className={ui.ghost} type="button" onClick={() => setEditor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
      {schedule ? (
        <div className={styles.modal}>
          <form className={styles.dialog} onSubmit={submitSchedule}>
            <h2>Reschedule</h2>
            <p className={styles.muted}>{schedule.title}</p>
            <div className={styles.form}>
              <label className={styles.field}>Start
                <input className={styles.control} type="date" min={todayInKolkata()} value={schedule.startDate} onChange={(event) => setSchedule({ ...schedule, startDate: event.target.value })} />
              </label>
              <label className={`${styles.field} ${styles.dueField}`}>Due
                <input className={styles.control} type="datetime-local" min={dueMin()} value={dueValue(schedule.dueDate, schedule.dueTime)} onChange={(event) => setSchedule(applyDue(schedule, event.target.value))} required />
              </label>
              <label className={`${styles.field} ${styles.wide}`}>Why reschedule
                <textarea className={styles.control} value={schedule.reason} onChange={(event) => setSchedule({ ...schedule, reason: event.target.value })} required />
              </label>
            </div>
            <div className={styles.row}>
              <button className={ui.primary} type="submit" disabled={busy}>{busy ? 'Saving...' : 'Reschedule'}</button>
              <button className={ui.ghost} type="button" onClick={() => setSchedule(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
      {prompt ? (
        <div className={styles.modal}>
          <form className={styles.dialog} onSubmit={submitReason}>
            <h2>{prompt.kind === 'reopen' ? 'Reopen this task' : prompt.status === 'hold' ? 'Hold this task' : 'Delete this task'}</h2>
            {prompt.kind === 'reopen' ? (
              <div className={styles.form}>
                <label className={styles.field}>Title
                  <input className={styles.control} value={prompt.title} onChange={(event) => setPrompt({ ...prompt, title: event.target.value })} required />
                </label>
                <label className={styles.field}>Priority
                  <select className={styles.control} value={prompt.priority} onChange={(event) => setPrompt({ ...prompt, priority: event.target.value })}>
                    {PRIORITIES.map((item) => <option key={item} value={item}>{PRIORITY_LABELS[item]}</option>)}
                  </select>
                </label>
                <label className={styles.field}>Start
                  <input className={styles.control} type="date" min={todayInKolkata()} value={prompt.startDate || ''} onChange={(event) => setPrompt({ ...prompt, startDate: event.target.value })} />
                </label>
                <label className={`${styles.field} ${styles.dueField}`}>Due
                  <input className={styles.control} type="datetime-local" min={dueMin()} value={dueValue(prompt.dueDate, prompt.dueTime)} onChange={(event) => setPrompt(applyDue(prompt, event.target.value))} />
                </label>
                <label className={`${styles.field} ${styles.wide}`}>Description
                  <textarea className={styles.control} value={prompt.description} onChange={(event) => setPrompt({ ...prompt, description: event.target.value })} />
                </label>
              </div>
            ) : null}
            <label className={styles.field}>Reason
              <textarea className={styles.control} value={prompt.reason} onChange={(event) => setPrompt({ ...prompt, reason: event.target.value })} required />
            </label>
            <div className={styles.row}>
              <button className={prompt.status === 'deleted' ? ui.danger : ui.primary} type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
              <button className={ui.ghost} type="button" onClick={() => setPrompt(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
