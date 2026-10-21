'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import UploadPanel from '@/components/UploadPanel';
import VideoList from '@/components/VideoList';
import { candidateFolder, normalizeCandidateId } from '@/lib/candidateId';
import { readJson } from '@/lib/readJson';
import ui from '@/components/ui.module.scss';
import styles from './dashboard.module.scss';

export default function Dashboard({ username, maxBytes, spacesReady }) {
  const router = useRouter();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [formError, setFormError] = useState('');

  const loadVideos = useCallback(async () => {
    if (!candidateId) {
      setVideos([]);
      setLoading(false);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await readJson(
        await fetch(`/api/videos?candidateId=${encodeURIComponent(candidateId)}`)
      );
      setVideos(data.videos || []);
    } catch (loadError) {
      if (loadError.status === 401) {
        router.replace('/login');
        return;
      }
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [candidateId, router]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  function openCandidate(event) {
    event.preventDefault();
    const checked = normalizeCandidateId(draftId);
    if (!checked.ok) {
      setFormError(checked.error);
      return;
    }
    setFormError('');
    setCandidateId(checked.candidateId);
  }

  async function logout() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Logo />
          <div>
            <strong>Candidate's Video Upload</strong>
            <p>Upload desk</p>
          </div>
        </div>
        <div className={styles.account}>
          <span>{username}</span>
          <button className={ui.ghost} type="button" onClick={logout} disabled={signingOut}>
            {signingOut ? 'Signing out...' : 'Log out'}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {spacesReady ? null : (
          <p className={styles.notice}>
            DigitalOcean Spaces is not configured yet. Add the bucket and keys to .env.local, then
            restart the server.
          </p>
        )}
        <section className={styles.candidate}>
          {candidateId ? (
            <div className={styles.candidateBar}>
              <div>
                <h2>Candidate {candidateId}</h2>
                <p>New videos are added to this folder, even when it already exists.</p>
              </div>
              <button
                className={ui.ghost}
                type="button"
                onClick={() => {
                  setCandidateId('');
                  setVideos([]);
                  setError('');
                }}
              >
                Change ID
              </button>
            </div>
          ) : (
            <>
              <div>
                <h2>Candidate ID</h2>
                <p>Enter the candidate ID. A folder with that ID is used inside course_Recored_videos.</p>
              </div>
              <form className={styles.candidateForm} onSubmit={openCandidate}>
                <label className={`${ui.field} ${styles.candidateField}`}>
                  <span>Candidate ID</span>
                  <input
                    className={ui.input}
                    name="candidateId"
                    value={draftId}
                    onChange={(event) => setDraftId(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </label>
                <button className={ui.primary} type="submit">
                  Continue
                </button>
              </form>
            </>
          )}
          {formError ? (
            <p className={ui.alert} role="alert">
              {formError}
            </p>
          ) : null}
          {candidateId ? <p className={styles.path}>{candidateFolder(candidateId)}</p> : null}
        </section>
        {candidateId ? (
          <>
            <UploadPanel maxBytes={maxBytes} candidateId={candidateId} onUploaded={loadVideos} />
            <VideoList
              videos={videos}
              loading={loading}
              error={error}
              onChange={loadVideos}
              candidateId={candidateId}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
