'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ui from '@/components/ui.module.scss';
import { formatDueDate, formatDueTime } from '@/lib/taskRules';
import { teamFetch } from './client';
import styles from './team.module.scss';

function dueText(item) {
  const date = item.dueDate ? formatDueDate(item.dueDate) : '';
  const time = item.dueTime ? formatDueTime(item.dueTime) : '';
  return [date, time].filter(Boolean).join(', ') || 'No due time';
}

export default function StatusAlert({ actor }) {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  function showAlerts() {
    return teamFetch('/api/team/alerts')
      .then((data) => {
        const items = data.alerts || [];
        setAlerts(items);
        setOpen(items.length > 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    showAlerts();
    return () => clearTimeout(timer.current);
  }, []);

  function close() {
    setOpen(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(showAlerts, 10000);
  }

  if (!open) return null;
  const board = actor.role === 'team_member' ? '/team/tasks?mine=1' : '/team/tasks';

  return (
    <div className={styles.modal} role="presentation" onClick={close}>
      <div className={`${styles.dialog} ${styles.detailDialog}`} role="dialog" aria-modal="true" aria-labelledby="attention-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.dialogHead}>
          <h2 id="attention-title">Update these tasks</h2>
          <button className={styles.close} type="button" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className={styles.dialogScroll}>
          <p className={styles.dialogMeta}>These tasks are pending, or due within 2 hours, and the status has not been updated.</p>
          <ul className={styles.alertList}>
            {alerts.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>
                  {item.kind === 'pending' ? 'Pending' : 'Due soon'}
                  {actor.role === 'team_member' ? '' : ` · ${item.assigneeName}`}
                  {actor.role === 'super_admin' && item.teamName ? ` · ${item.teamName}` : ''}
                  {` · ${dueText(item)}`}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.row}>
            <Link className={ui.primary} href={board} onClick={close}>Open Work Flow</Link>
            <button className={ui.ghost} type="button" onClick={close}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
