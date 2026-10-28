'use client';

import { useEffect, useState } from 'react';
import ui from '@/components/ui.module.scss';
import { ROLE_LABELS, teamFetch } from '@/components/team/client';
import styles from '@/components/team/team.module.scss';

const EMPTY = { name: '', email: '', password: '', role: 'team_member', teamId: '', isActive: true, canCreateTasks: false, canManageMembers: false };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  function load() {
    teamFetch(`/api/team/users?q=${encodeURIComponent(query)}`).then((data) => setUsers(data.users || [])).catch((loadError) => setError(loadError.message));
  }

  useEffect(() => {
    load();
    teamFetch('/api/team/teams').then((data) => setTeams(data.teams || [])).catch(() => {});
  }, []);

  async function save(event) {
    event.preventDefault();
    setError('');
    try {
      await teamFetch(editing ? `/api/team/users/${editing}` : '/api/team/users', {
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

  return (
    <>
      <h1>Users</h1>
      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input className={styles.control} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" />
        <button className={ui.ghost} type="submit">Search</button>
      </form>
      {error ? <p className={ui.alert}>{error}</p> : null}
      <table className={styles.table}>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{ROLE_LABELS[user.role] || user.role}</td>
              <td>{user.is_active ? 'Yes' : 'No'}</td>
              <td><button className={ui.ghost} type="button" onClick={() => { setEditing(user.id); setForm({ name: user.name, email: user.email, password: '', role: user.role, teamId: user.team_id || '', isActive: Boolean(user.is_active), canCreateTasks: Boolean(user.can_create_tasks), canManageMembers: Boolean(user.can_manage_members) }); }}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className={styles.dialog} onSubmit={save}>
        <h2>{editing ? 'Edit user' : 'Add user'}</h2>
        <div className={styles.form}>
          <label className={styles.field}>Name<input className={styles.control} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className={styles.field}>Email<input className={styles.control} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label className={styles.field}>{editing ? 'New password' : 'Password'}<input className={styles.control} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} minLength={editing ? undefined : 8} /></label>
          <label className={styles.field}>Role
            <select className={styles.control} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="team_member">Team Member</option>
              <option value="team_leader">Team Leader</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <label className={styles.field}>Work Flow
            <select className={styles.control} value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}>
              <option value="">None</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          {editing ? <label className={styles.row}><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label> : null}
          <label className={styles.row}><input type="checkbox" checked={form.canCreateTasks} onChange={(event) => setForm({ ...form, canCreateTasks: event.target.checked })} /> Can create personal tasks</label>
          <label className={styles.row}><input type="checkbox" checked={form.canManageMembers} onChange={(event) => setForm({ ...form, canManageMembers: event.target.checked })} /> Can manage team members</label>
        </div>
        <button className={ui.primary} type="submit">{editing ? 'Save user' : 'Create user'}</button>
      </form>
    </>
  );
}
