'use client';

import { useEffect, useState } from 'react';
import { teamFetch } from '@/components/team/client';
import styles from '@/components/team/team.module.scss';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    teamFetch('/api/team/dashboard').then(setData).catch((loadError) => setError(loadError.message));
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading reports...</p>;

  return (
    <>
      <h1>Reports</h1>
      <div className={styles.cards}>
        <article className={styles.card}><span>To Do</span><strong>{data.summary.todo}</strong></article>
        <article className={styles.card}><span>Pending</span><strong>{data.summary.pending}</strong></article>
        <article className={styles.card}><span>Completed</span><strong>{data.summary.completed}</strong></article>
        <article className={styles.card}><span>Overdue</span><strong>{data.summary.overdue}</strong></article>
      </div>
      {data.teams?.length ? (
        <table className={styles.table}>
          <thead><tr><th>Work Flow</th><th>To Do</th><th>Pending</th><th>Completed</th><th>Overdue</th></tr></thead>
          <tbody>{data.teams.map((team) => <tr key={team.id}><td>{team.name}</td><td>{team.todo || 0}</td><td>{team.pending || 0}</td><td>{team.completed || 0}</td><td>{team.overdue || 0}</td></tr>)}</tbody>
        </table>
      ) : null}
      {data.members?.length ? (
        <table className={styles.table}>
          <thead><tr><th>Member</th><th>To Do</th><th>Pending</th><th>Completed</th><th>Overdue</th></tr></thead>
          <tbody>{data.members.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.todo || 0}</td><td>{member.pending || 0}</td><td>{member.completed || 0}</td><td>{member.overdue || 0}</td></tr>)}</tbody>
        </table>
      ) : null}
    </>
  );
}
