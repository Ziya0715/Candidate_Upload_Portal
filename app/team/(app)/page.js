'use client';

import { useEffect, useState } from 'react';
import { STATUS_LABELS, teamFetch } from '@/components/team/client';
import styles from '@/components/team/team.module.scss';

export default function TeamHomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    teamFetch('/api/team/dashboard').then(setData).catch((loadError) => setError(loadError.message));
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading dashboard...</p>;
  const cards = [
    ['Work flows', data.summary.teams],
    ['Active users', data.summary.users],
    ['Team members', data.summary.members],
    ['Tasks', data.summary.total],
    ['To Do', data.summary.todo],
    ['Pending', data.summary.pending],
    ['Completed', data.summary.completed],
    ['Overdue', data.summary.overdue],
  ].filter((item) => item[1] !== undefined);

  return (
    <>
      <h1>Dashboard</h1>
      <div className={styles.cards}>
        {cards.map(([label, value]) => (
          <article key={label} className={styles.card}><span>{label}</span><strong>{value}</strong></article>
        ))}
      </div>
      {data.teams?.length ? (
        <>
          <h2>Work Flow</h2>
          <table className={styles.table}>
            <thead><tr><th>Work Flow</th><th>To Do</th><th>Pending</th><th>Completed</th><th>Overdue</th></tr></thead>
            <tbody>
              {data.teams.map((team) => (
                <tr key={team.id}><td>{team.name}</td><td>{team.todo || 0}</td><td>{team.pending || 0}</td><td>{team.completed || 0}</td><td>{team.overdue || 0}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {data.members?.length ? (
        <>
          <h2>Members</h2>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>To Do</th><th>Pending</th><th>Completed</th><th>Overdue</th></tr></thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id}><td>{member.name}</td><td>{member.todo || 0}</td><td>{member.pending || 0}</td><td>{member.completed || 0}</td><td>{member.overdue || 0}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      <h2>Upcoming</h2>
      {data.upcoming.length ? data.upcoming.map((task) => (
        <p key={task.id}>{task.title} · {task.assigneeName} · {task.dueDate}{task.dueTime ? ` ${task.dueTime}` : ''} · {STATUS_LABELS[task.status]}</p>
      )) : <p className={styles.muted}>No upcoming deadlines.</p>}
    </>
  );
}
