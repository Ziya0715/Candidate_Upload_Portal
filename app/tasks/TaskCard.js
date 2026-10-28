'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDueDate, formatDueTime } from '@/lib/taskRules';
import styles from './tasks.module.scss';

export default function TaskCard({ task, busy, onOpen, onEdit, onReschedule, onComplete, onReopen, onHold, onRelease, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const priorityClass = task.priority === 'High' ? styles.high : task.priority === 'Low' ? styles.low : styles.medium;

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

  function choose(action) {
    setOpen(false);
    action(task);
  }

  return (
    <article className={`${styles.card} ${task.status === 'Pending' ? styles.overdue : ''}`}>
      <button className={styles.cardBody} type="button" onClick={() => onOpen(task)}>
        <span className={styles.cardTitle}>{task.title}</span>
        <span className={styles.meta}>
          <span className={`${styles.badge} ${priorityClass}`}>{task.priority}</span>
          {task.status === 'Hold' || task.status === 'Deleted' ? (
            <span className={`${styles.badge} ${task.status === 'Deleted' ? styles.high : styles.medium}`}>
              {task.status === 'Deleted' ? 'Deleted' : 'Hold'}
            </span>
          ) : null}
          <span>{formatDueDate(task.dueDate)}</span>
          <span>{formatDueTime(task.dueTime)}</span>
        </span>
        {task.overdueLabel ? <span className={styles.late}>{task.overdueLabel}</span> : null}
      </button>
      {task.status === 'Deleted' ? null : (
      <div className={styles.menuWrap} ref={menuRef}>
        <button
          className={styles.kebab}
          type="button"
          aria-label="Task actions"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={busy}
          onClick={() => setOpen((value) => !value)}
        >
          ⋮
        </button>
        {open ? (
          <div className={styles.menu} role="menu">
            {task.status === 'Complete' ? (
              <>
                <button type="button" role="menuitem" onClick={() => choose(onReopen)}>
                  Reopen
                </button>
                <button type="button" role="menuitem" onClick={() => choose(onHold)}>
                  Hold
                </button>
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={() => choose(onEdit)}>
                  Edit
                </button>
                <button type="button" role="menuitem" onClick={() => choose(onReschedule)}>
                  Reschedule
                </button>
                {task.status === 'Hold' ? (
                  <button type="button" role="menuitem" onClick={() => choose(onRelease)}>
                    Release
                  </button>
                ) : (
                  <button type="button" role="menuitem" onClick={() => choose(onHold)}>
                    Put on hold
                  </button>
                )}
                <button type="button" role="menuitem" onClick={() => choose(onComplete)}>
                  Mark complete
                </button>
                <button className={styles.menuDanger} type="button" role="menuitem" onClick={() => choose(onDelete)}>
                  Delete
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      )}
    </article>
  );
}
