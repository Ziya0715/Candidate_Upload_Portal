'use client';

import { useEffect, useState } from 'react';
import ui from '@/components/ui.module.scss';
import { teamFetch } from '@/components/team/client';
import styles from '@/components/team/team.module.scss';

const EMPTY = { name: '', description: '', isActive: true };

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');

  function load() {
    teamFetch('/api/team/teams').then((data) => setTeams(data.teams || [])).catch((loadError) => setError(loadError.message));
    teamFetch('/api/team/users').then((data) => setUsers(data.users || [])).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    setError('');
    try {
      await teamFetch(editing ? `/api/team/teams/${editing}` : '/api/team/teams', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setForm(EMPTY);
      setEditing('');
      load();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function setLeader(teamId, leaderId) {
    setError('');
    try {
      await teamFetch(`/api/team/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify({ leaderId }) });
      load();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <>
      <h1>Work Flow</h1>
      {error ? <p className={ui.alert}>{error}</p> : null}
      <table className={styles.table}>
        <thead><tr><th>Name</th><th>Leader</th><th>Members</th><th>Status</th><th>Leader</th><th></th></tr></thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td>{team.name}</td>
              <td>{team.leader_name || '—'}</td>
              <td>{team.member_count}</td>
              <td>{team.is_active ? 'Active' : 'Inactive'}</td>
              <td>
                <select className={styles.control} value={team.leader_id || ''} onChange={(event) => setLeader(team.id, event.target.value)}>
                  <option value="">None</option>
                  {users.filter((user) => user.role !== 'super_admin' && user.is_active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </td>
              <td><button className={ui.ghost} type="button" onClick={() => { setEditing(team.id); setForm({ name: team.name, description: team.description, isActive: Boolean(team.is_active) }); }}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className={styles.dialog} onSubmit={save}>
        <h2>{editing ? 'Edit work flow' : 'Add work flow'}</h2>
        <div className={styles.form}>
          <label className={styles.field}>Name<input className={styles.control} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className={styles.field}>Description<input className={styles.control} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className={styles.row}><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
        </div>
        <button className={ui.primary} type="submit">{editing ? 'Save work flow' : 'Create work flow'}</button>
      </form>
    </>
  );
}
