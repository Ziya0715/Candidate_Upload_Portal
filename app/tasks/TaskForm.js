'use client';

import { useState } from 'react';
import { TASK_PRIORITIES, todayInKolkata } from '@/lib/taskRules';
import ui from '@/components/ui.module.scss';
import styles from './tasks.module.scss';

export default function TaskForm({ task, busy, error, onSubmit, onClose }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [dueTime, setDueTime] = useState(task?.dueTime || '');
  const [priority, setPriority] = useState(task?.priority || 'Medium');
  const [localError, setLocalError] = useState('');
  const scheduleLocked = Boolean(task);

  function submit(event) {
    event.preventDefault();
    if (!title.trim()) {
      setLocalError('Enter a task title.');
      return;
    }
    if (!dueDate) {
      setLocalError('Enter a due date.');
      return;
    }
    setLocalError('');
    onSubmit({ title, description, dueDate, dueTime, priority });
  }

  return (
    <div className={styles.modal} role="presentation">
      <form className={styles.dialog} onSubmit={submit}>
        <h2>{task ? 'Edit task' : 'New task'}</h2>
        <label className={styles.field}>
          <span>Task title</span>
          <input className={styles.control} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <textarea className={styles.control} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Due date</span>
          <input
            className={styles.control}
            type="date"
            min={todayInKolkata()}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required={!scheduleLocked}
            disabled={scheduleLocked}
          />
        </label>
        <label className={styles.field}>
          <span>Due time</span>
          <input
            className={styles.control}
            type="time"
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
            disabled={scheduleLocked}
          />
        </label>
        <label className={styles.field}>
          <span>Priority</span>
          <select className={styles.control} value={priority} onChange={(event) => setPriority(event.target.value)}>
            {TASK_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
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
            {busy ? 'Saving...' : 'Save task'}
          </button>
        </div>
      </form>
    </div>
  );
}
