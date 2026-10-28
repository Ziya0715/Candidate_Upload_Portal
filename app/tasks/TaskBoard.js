'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SideNav from '@/components/SideNav';
import shell from '@/components/SideNav.module.scss';
import { readJson } from '@/lib/readJson';
import { deadlineFor, presentTask, TASK_PRIORITIES, todayInKolkata } from '@/lib/taskRules';
import ui from '@/components/ui.module.scss';
import TaskCard from './TaskCard';
import TaskDetail from './TaskDetail';
import TaskForm from './TaskForm';
import TaskReopen from './TaskReopen';
import TaskReschedule from './TaskReschedule';
import styles from './tasks.module.scss';

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

const PAGE_SIZE = 5;

const COLUMNS = [
  { status: 'To Do', label: 'To Do', statuses: ['To Do'], className: '' },
  { status: 'Hold', label: 'Hold/delete', statuses: ['Hold', 'Deleted'], className: styles.hold },
  { status: 'Pending', label: 'Pending', statuses: ['Pending'], className: styles.pending },
  { status: 'Complete', label: 'Complete', statuses: ['Complete'], className: styles.done },
];

const EMPTY_PAGES = { 'To Do': 1, Hold: 1, Pending: 1, Complete: 1 };

const ACTION_NOTICES = {
  complete: 'Task completed.',
  reopen: 'Task reopened.',
  hold: 'Task put on hold.',
  release: 'Task released.',
};

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export default function TaskBoard({ username }) {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('All');
  const [due, setDue] = useState('all');
  const [sort, setSort] = useState('due');
  const [completedOn, setCompletedOn] = useState('');
  const [editor, setEditor] = useState(null);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [reopenTarget, setReopenTarget] = useState(null);
  const [holdTarget, setHoldTarget] = useState(null);
  const [pages, setPages] = useState(EMPTY_PAGES);

  const loadTasks = useCallback(async (quiet = false) => {
    if (!quiet) {
      setError('');
      setLoading(true);
    }
    try {
      const data = await readJson(await fetch('/api/tasks'));
      setTasks(data.tasks || []);
      setError('');
    } catch (loadError) {
      if (loadError.status === 401) {
        router.replace('/login');
        return;
      }
      setError(loadError.message);
      if (quiet) throw loadError;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setPages(EMPTY_PAGES);
  }, [search, priority, due, sort, completedOn]);

  useEffect(() => {
    if (!selectedId || editor || pendingDelete || reopenTarget || holdTarget) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setSelectedId('');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editor, pendingDelete, reopenTarget, holdTarget]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = todayInKolkata(now);
    const rows = tasks
      .map((task) => presentTask(task, now))
      .filter((task) => {
        if (query && !task.title.toLowerCase().includes(query)) return false;
        if (priority !== 'All' && task.priority !== priority) return false;
        if (due === 'overdue' && task.status !== 'Pending') return false;
        if (due === 'today' && task.dueDate !== today) return false;
        if (due === 'upcoming' && task.status !== 'To Do') return false;
        if (completedOn) {
          const completedDay = task.completedAt ? todayInKolkata(new Date(task.completedAt).getTime()) : '';
          if (completedDay !== completedOn) return false;
        }
        return true;
      });

    rows.sort((left, right) => {
      if (sort === 'priority') {
        return (PRIORITY_RANK[left.priority] ?? 9) - (PRIORITY_RANK[right.priority] ?? 9);
      }
      const leftTime = deadlineFor(left.dueDate, left.dueTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTime = deadlineFor(right.dueDate, right.dueTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
    return rows;
  }, [tasks, search, priority, due, sort, completedOn, now]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const task = tasks.find((item) => item.taskId === selectedId);
    return task ? presentTask(task, now) : null;
  }, [tasks, selectedId, now]);

  async function runAction(work, success) {
    setBusy(true);
    setError('');
    try {
      await work();
      await loadTasks(true);
      setNotice(success);
      setEditor(null);
      setPendingDelete(null);
      setReopenTarget(null);
      setHoldTarget(null);
      setFormError('');
    } catch (actionError) {
      if (actionError.status === 401) {
        router.replace('/login');
        return;
      }
      if (editor || reopenTarget || holdTarget || pendingDelete) setFormError(actionError.message);
      else setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  function saveTask(input) {
    const reschedule = editor.mode === 'reschedule';
    const path = editor.task ? `/api/tasks/${editor.task.taskId}` : '/api/tasks';
    const method = editor.task ? 'PATCH' : 'POST';
    const body = reschedule
      ? {
          title: editor.task.title,
          description: editor.task.description,
          priority: editor.task.priority,
          dueDate: input.dueDate,
          dueTime: input.dueTime,
          rescheduleReason: input.reason,
        }
      : input;
    return runAction(async () => {
      await readJson(
        await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );
    }, reschedule ? 'Task rescheduled.' : editor.task ? 'Task updated.' : 'Task added.');
  }

  function askReopen(task) {
    setFormError('');
    setReopenTarget(task);
  }

  function saveReopen(reason) {
    return runAction(async () => {
      await readJson(
        await fetch(`/api/tasks/${reopenTarget.taskId}/reopen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
      );
    }, 'Task reopened.');
  }

  function askHold(task) {
    setFormError('');
    setHoldTarget(task);
  }

  function saveHold(reason) {
    return runAction(async () => {
      await readJson(
        await fetch(`/api/tasks/${holdTarget.taskId}/hold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
      );
    }, 'Task put on hold.');
  }

  function mutate(task, action) {
    return runAction(async () => {
      await readJson(await fetch(`/api/tasks/${task.taskId}/${action}`, { method: 'POST' }));
    }, ACTION_NOTICES[action] || 'Task updated.');
  }

  async function logout() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className={shell.shell}>
      <SideNav username={username} signingOut={signingOut} onLogout={logout} />
      <div className={shell.content}>
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <label className={`${styles.field} ${styles.grow}`}>
            <span>Search</span>
            <input className={styles.control} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Priority</span>
            <select className={styles.control} value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="All">All</option>
              {TASK_PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Due</span>
            <select className={styles.control} value={due} onChange={(event) => setDue(event.target.value)}>
              <option value="all">All tasks</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="upcoming">Still to do</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Completed on</span>
            <input className={styles.control} type="date" value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Sort</span>
            <select className={styles.control} value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
            </select>
          </label>
          <button className={ui.primary} type="button" onClick={() => { setFormError(''); setEditor({ task: null }); }}>
            New task
          </button>
        </div>

        {notice ? <p className={ui.success}>{notice}</p> : null}
        {error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p>Loading tasks...</p> : null}

        <div className={styles.board}>
          {COLUMNS.map((column) => {
            const cards = visible.filter((task) => column.statuses.includes(task.status));
            const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
            const page = Math.min(pages[column.status] || 1, pageCount);
            const start = (page - 1) * PAGE_SIZE;
            const pageCards = cards.slice(start, start + PAGE_SIZE);
            return (
              <section key={column.status} className={`${styles.column} ${column.className}`}>
                <div className={styles.columnHead}>
                  <h2>{column.label}</h2>
                  <span className={styles.columnTools}>
                    <RefreshButton label={column.label} busy={loading || busy} onClick={() => { setPages(EMPTY_PAGES); loadTasks(); }} />
                    <span className={styles.count}>{cards.length}</span>
                  </span>
                </div>
                {pageCards.length ? (
                  <div className={styles.cards}>
                    {pageCards.map((task) => (
                      <TaskCard
                        key={task.taskId}
                        task={task}
                        busy={busy}
                        onOpen={(item) => setSelectedId(item.taskId)}
                        onEdit={(item) => {
                          setFormError('');
                          setEditor({ task: item });
                        }}
                        onReschedule={(item) => {
                          setFormError('');
                          setEditor({ task: item, mode: 'reschedule' });
                        }}
                        onComplete={(item) => mutate(item, 'complete')}
                        onReopen={askReopen}
                        onHold={askHold}
                        onRelease={(item) => mutate(item, 'release')}
                        onDelete={setPendingDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>{loading ? 'Loading...' : 'No tasks'}</p>
                )}
                {cards.length > PAGE_SIZE ? (
                  <div className={styles.pager}>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPages((current) => ({ ...current, [column.status]: page - 1 }))}
                    >
                      Previous
                    </button>
                    <span>
                      {page} / {pageCount}
                    </span>
                    <button
                      type="button"
                      disabled={page >= pageCount}
                      onClick={() => setPages((current) => ({ ...current, [column.status]: page + 1 }))}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </main>

      {selected ? (
        <TaskDetail
          task={selected}
          busy={busy}
          onClose={() => setSelectedId('')}
          onEdit={(item) => {
            setFormError('');
            setEditor({ task: item });
          }}
          onComplete={(item) => mutate(item, 'complete')}
          onReopen={askReopen}
          onHold={askHold}
          onRelease={(item) => mutate(item, 'release')}
          onDelete={setPendingDelete}
        />
      ) : null}

      {editor?.mode === 'reschedule' ? (
        <TaskReschedule
          task={editor.task}
          busy={busy}
          error={formError}
          onClose={() => {
            if (busy) return;
            setEditor(null);
            setFormError('');
          }}
          onSubmit={saveTask}
        />
      ) : null}

      {editor && editor.mode !== 'reschedule' ? (
        <TaskForm
          task={editor.task}
          busy={busy}
          error={formError}
          onClose={() => {
            if (busy) return;
            setEditor(null);
            setFormError('');
          }}
          onSubmit={saveTask}
        />
      ) : null}

      {reopenTarget ? (
        <TaskReopen
          task={reopenTarget}
          busy={busy}
          error={formError}
          onClose={() => {
            if (busy) return;
            setReopenTarget(null);
            setFormError('');
          }}
          onSubmit={saveReopen}
        />
      ) : null}

      {holdTarget ? (
        <TaskReopen
          task={holdTarget}
          busy={busy}
          error={formError}
          title="Put on hold"
          label="Why hold"
          submitLabel="Hold"
          emptyMessage="Enter why this task is being put on hold."
          onClose={() => {
            if (busy) return;
            setHoldTarget(null);
            setFormError('');
          }}
          onSubmit={saveHold}
        />
      ) : null}

      {pendingDelete ? (
        <TaskReopen
          task={pendingDelete}
          busy={busy}
          error={formError}
          title="Delete task"
          label="Why delete"
          submitLabel="Delete"
          emptyMessage="Enter why this task is being deleted."
          onClose={() => {
            if (busy) return;
            setPendingDelete(null);
            setFormError('');
          }}
          onSubmit={(reason) =>
            runAction(async () => {
              await readJson(
                await fetch(`/api/tasks/${pendingDelete.taskId}`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reason }),
                })
              );
            }, 'Task moved to Hold/delete.')
          }
        />
      ) : null}
      </div>
    </div>
  );
}
