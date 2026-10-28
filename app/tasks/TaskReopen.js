'use client';

import { useState } from 'react';
import ui from '@/components/ui.module.scss';
import styles from './tasks.module.scss';

export default function TaskReopen({
  task,
  busy,
  error,
  onSubmit,
  onClose,
  title = 'Reopen task',
  label = 'Why reopen',
  submitLabel = 'Reopen',
  emptyMessage = 'Enter why this task is being reopened.',
}) {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');

  function submit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setLocalError(emptyMessage);
      return;
    }
    if (text.length > 500) {
      setLocalError('The reason must be 500 characters or less.');
      return;
    }
    setLocalError('');
    onSubmit(text);
  }

  return (
    <div className={styles.modal} role="presentation">
      <form className={styles.dialog} onSubmit={submit}>
        <h2>{title}</h2>
        <p className={styles.rescheduleTitle}>{task.title}</p>
        <label className={styles.field}>
          <span>{label}</span>
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
            {busy ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
