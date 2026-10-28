'use client';

import { formatDueDate, formatDueTime } from '@/lib/taskRules';
import ui from '@/components/ui.module.scss';
import styles from './tasks.module.scss';

function formatCompleted(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export default function TaskDetail({ task, busy, onClose, onEdit, onComplete, onReopen, onHold, onRelease, onDelete }) {
  const priorityClass = task.priority === 'High' ? styles.high : task.priority === 'Low' ? styles.low : styles.medium;
  const completed = formatCompleted(task.completedAt);
  const description = String(task.description || '').trim();

  return (
    <div className={styles.modal} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
        <div className={styles.detailHead}>
          <h2 id="task-detail-title">{task.title}</h2>
          <button className={ui.ghost} type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.meta}>
          <span className={`${styles.badge} ${priorityClass}`}>{task.priority}</span>
          <span className={styles.badge}>{task.status}</span>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Due date</dt>
            <dd>{formatDueDate(task.dueDate)}</dd>
          </div>
          <div>
            <dt>Due time</dt>
            <dd>{formatDueTime(task.dueTime)}</dd>
          </div>
          {completed ? (
            <div>
              <dt>Completed</dt>
              <dd>{completed}</dd>
            </div>
          ) : null}
        </dl>
        {task.reopenReason ? (
          <p className={styles.reason}>
            <span>Reopen reason</span>
            {task.reopenReason}
          </p>
        ) : null}
        {task.holdReason ? (
          <p className={styles.reason}>
            <span>Hold reason</span>
            {task.holdReason}
          </p>
        ) : null}
        {task.rescheduleReason ? (
          <p className={styles.reason}>
            <span>Reschedule reason</span>
            {task.rescheduleReason}
          </p>
        ) : null}
        {task.deleteReason ? (
          <p className={styles.reason}>
            <span>Delete reason</span>
            {task.deleteReason}
          </p>
        ) : null}
        {task.overdueLabel ? <p className={styles.late}>{task.overdueLabel}</p> : null}
        <p className={styles.description}>{description || 'No description'}</p>
        {task.status === 'Deleted' ? null : (
        <div className={styles.row}>
          {task.status === 'Complete' ? (
            <>
              <button className={ui.ghost} type="button" onClick={() => onReopen(task)} disabled={busy}>
                Reopen
              </button>
              <button className={ui.ghost} type="button" onClick={() => onHold(task)} disabled={busy}>
                Hold
              </button>
            </>
          ) : (
            <>
              <button className={ui.ghost} type="button" onClick={() => onEdit(task)} disabled={busy}>
                Edit
              </button>
              {task.status === 'Hold' ? (
                <button className={ui.ghost} type="button" onClick={() => onRelease(task)} disabled={busy}>
                  Release
                </button>
              ) : (
                <button className={ui.ghost} type="button" onClick={() => onHold(task)} disabled={busy}>
                  Put on hold
                </button>
              )}
              <button className={ui.primary} type="button" onClick={() => onComplete(task)} disabled={busy}>
                Mark complete
              </button>
              <button className={ui.danger} type="button" onClick={() => onDelete(task)} disabled={busy}>
                Delete
              </button>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
