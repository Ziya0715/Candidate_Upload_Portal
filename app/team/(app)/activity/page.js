'use client';

import { useEffect, useState } from 'react';
import { teamFetch } from '@/components/team/client';
import styles from '@/components/team/team.module.scss';

export default function ActivityPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    teamFetch('/api/team/activity').then((data) => setRows(data.activity || [])).catch((loadError) => setError(loadError.message));
  }, []);

  if (error) return <p>{error}</p>;

  return (
    <>
      <h1>Activity logs</h1>
      <table className={styles.table}>
        <thead><tr><th>When</th><th>Who</th><th>Task</th><th>Action</th><th>Change</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.created_at}</td>
              <td>{row.user_name || 'System'}</td>
              <td>{row.task_title || ''}</td>
              <td>{row.action}</td>
              <td>{row.old_value} {row.new_value ? `→ ${row.new_value}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length ? null : <p className={styles.muted}>No activity yet.</p>}
    </>
  );
}
