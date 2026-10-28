'use client';

import { useState } from 'react';
import { todayInKolkata } from '@/lib/taskRules';
import ui from '@/components/ui.module.scss';
import styles from './tasks.module.scss';

export default function TaskReschedule({ task, busy, error, onSubmit, onClose }) {
  const today = todayInKolkata();
  const [dueDate, setDueDate] = useState(task?.dueDate && task.dueDate >= today ? task.dueDate : '');
  const [dueTime, setDueTime] = useState(task?.dueTime || '');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');

  function submit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (!dueDate) {
      setLocalError('Enter a due date.');
      return;
    }
    if (!text) {
      setLocalError('Enter why this task is being rescheduled.');
      return;
    }
    if (text.length > 500) {
      setLocalError('The reason must be 500 characters or less.');
      return;
    }
    setLocalError('');
    onSubmit({ dueDate, dueTime, reason: text });
  }

  return (
    <div className={styles.modal} role="presentation">
      <form className={styles.dialog} onSubmit={submit}>
        <h2>Reschedule</h2>
        <p className={styles.rescheduleTitle}>{task.title}</p>
        <label className={styles.field}>
          <span>Due date</span>
          <input className={styles.control} type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Due time</span>
          <input className={styles.control} type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Why reschedule</span>
          <textarea className={styles.control} value={reason} onChange={(event) => setReason(event.target.value)} required />
        </label>
        {localError || error ? (
          <p className={ui.alert} role="alert">
            {localError || error}
          </p>
        ) : null}
        <div className={styles.row}>
          <button className={ui.ghost} type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={ui.primary} type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Reschedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
