'use client';

import { useCallback, useEffect, useState } from 'react';
import Logo from '@/components/Logo';
import { readJson } from '@/lib/readJson';
import ui from '@/components/ui.module.scss';
import styles from './watch.module.scss';

export default function WatchPlayer({ token, filename }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setUrl('');
    try {
      const data = await readJson(await fetch(`/api/share/${token}`));
      setUrl(data.url);
    } catch (loadError) {
      setError(loadError.message || 'This video could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <p className={styles.brand}>
          <Logo />
          Video Share
        </p>
        <h1>{filename}</h1>
        {loading ? <p className={styles.status}>Loading video...</p> : null}
        {error ? (
          <div>
            <p className={ui.alert} role="alert">
              {error}
            </p>
            <button className={`${ui.primary} ${styles.retry}`} type="button" onClick={load}>
              Try again
            </button>
          </div>
        ) : null}
        {url ? (
          <video
            className={styles.player}
            src={url}
            controls
            playsInline
            preload="metadata"
            referrerPolicy="no-referrer"
            onError={() => {
              setError('Playback failed. Try again. If it still will not play, ask for an MP4 or WebM file.');
            }}
          />
        ) : null}
        <p className={styles.note}>You can open this page again any time. No login is required.</p>
      </article>
    </main>
  );
}
