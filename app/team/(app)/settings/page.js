'use client';

import { useState } from 'react';
import ui from '@/components/ui.module.scss';
import { teamFetch } from '@/components/team/client';
import styles from '@/components/team/team.module.scss';

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await teamFetch('/api/team/settings', { method: 'POST', body: JSON.stringify({ currentPassword, nextPassword }) });
      setCurrentPassword('');
      setNextPassword('');
      setNotice('Password updated.');
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <form className={styles.dialog} onSubmit={submit}>
        <h2>Change password</h2>
        <div className={styles.form}>
          <label className={styles.field}>Current password<input className={styles.control} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label className={styles.field}>New password<input className={styles.control} type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required minLength={8} /></label>
        </div>
        {error ? <p className={ui.alert}>{error}</p> : null}
        {notice ? <p>{notice}</p> : null}
        <button className={ui.primary} type="submit">Save password</button>
      </form>
    </>
  );
}
