'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import UploadPanel from '@/components/UploadPanel';
import VideoList from '@/components/VideoList';
import { normalizeCandidateId } from '@/lib/candidateId';
import { readJson } from '@/lib/readJson';
import ui from '@/components/ui.module.scss';
import styles from './dashboard.module.scss';

function optionLabel(item) {
  return item.stName ? `${item.candidateId} -- ${item.stName}` : item.candidateId;
}

export default function Dashboard({ username, maxBytes, spacesReady }) {
  const router = useRouter();
  const suggestRef = useRef(null);
  const loadTicket = useRef(0);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [draftQuery, setDraftQuery] = useState('');
  const [picked, setPicked] = useState('');
  const [selected, setSelected] = useState(null);
  const [postError, setPostError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadVideos = useCallback(async () => {
    if (!selected?.candidateId) {
      setVideos([]);
      setLoading(false);
      return;
    }

    const ticket = loadTicket.current + 1;
    loadTicket.current = ticket;
    setError('');
    setLoading(true);
    try {
      const data = await readJson(
        await fetch(`/api/videos?candidateId=${encodeURIComponent(selected.candidateId)}`)
      );
      if (ticket !== loadTicket.current) return;
      setVideos(data.videos || []);
    } catch (loadError) {
      if (ticket !== loadTicket.current) return;
      if (loadError.status === 401) {
        router.replace('/login');
        return;
      }
      setError(loadError.message);
      setVideos([]);
    } finally {
      if (ticket === loadTicket.current) setLoading(false);
    }
  }, [router, selected]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!suggestRef.current?.contains(event.target)) setMenuOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const query = draftQuery.trim();
    if (!query || query === picked) {
      setSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await readJson(
          await fetch(`/api/candidates?suggest=1&q=${encodeURIComponent(query)}`)
        );
        setSuggestions(data.candidates || []);
        setMenuOpen(true);
      } catch (suggestError) {
        if (suggestError.status === 401) {
          router.replace('/login');
          return;
        }
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [draftQuery, picked, router]);

  function choose(item) {
    const checked = normalizeCandidateId(item.candidateId);
    if (!checked.ok) {
      setPostError(checked.error);
      return;
    }

    const query = draftQuery.trim().toLowerCase();
    const idHit = checked.candidateId.toLowerCase().includes(query);
    const display = idHit || !item.stName ? checked.candidateId : item.stName;
    setDraftQuery(display);
    setPicked(display);
    setSelected({ candidateId: checked.candidateId, stName: item.stName || '' });
    setSuggestions([]);
    setMenuOpen(false);
    setUploadOpen(false);
    setPostError('');
    setVideos([]);
    setLoading(true);
  }

  function onDraft(value) {
    setDraftQuery(value);
    setPicked('');
    setSelected(null);
    setVideos([]);
    setUploadOpen(false);
    setPostError('');
    setMenuOpen(true);
  }

  async function postCandidate(event) {
    event.preventDefault();
    const query = draftQuery.trim();
    if (!query) {
      setPostError('Enter a candidate ID or name.');
      return;
    }

    let rows = suggestions;
    if (!rows.length || query !== picked) {
      try {
        const data = await readJson(
          await fetch(`/api/candidates?suggest=1&q=${encodeURIComponent(query)}`)
        );
        rows = data.candidates || [];
      } catch (suggestError) {
        if (suggestError.status === 401) {
          router.replace('/login');
          return;
        }
        rows = [];
      }
    }

    const exactId = rows.find((item) => item.candidateId.toLowerCase() === query.toLowerCase());
    if (exactId) {
      choose(exactId);
      return;
    }

    const exactNames = rows.filter((item) => (item.stName || '').toLowerCase() === query.toLowerCase());
    if (exactNames.length === 1) {
      choose(exactNames[0]);
      return;
    }

    if (rows.length === 1) {
      choose(rows[0]);
      return;
    }

    if (rows.length > 1) {
      setSuggestions(rows);
      setMenuOpen(true);
      return;
    }

    const checked = normalizeCandidateId(query);
    if (!checked.ok) {
      setPostError('No record');
      return;
    }

    choose({ candidateId: checked.candidateId, stName: '' });
  }

  async function logout() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const hasVideos = Boolean(selected) && !loading && videos.length > 0;
  const firstUpload = Boolean(selected) && !loading && videos.length === 0 && !error;
  const showUpload = firstUpload || (hasVideos && uploadOpen);

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
          <div>
            <h2>Post a candidate</h2>
            <p>Type a candidate ID or name.</p>
          </div>
          <form className={styles.candidateForm} onSubmit={postCandidate}>
            <div className={styles.suggest} ref={suggestRef}>
              <label className={ui.field}>
                <span>Candidate</span>
                <input
                  className={`${ui.input} ${styles.suggestInput}`}
                  type="text"
                  name="candidate"
                  value={draftQuery}
                  onChange={(event) => onDraft(event.target.value)}
                  onFocus={() => {
                    if (suggestions.length) setMenuOpen(true);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              {menuOpen && suggestions.length ? (
                <ul className={styles.menu} role="listbox">
                  {suggestions.map((item) => (
                    <li key={item.candidateId}>
                      <button
                        className={styles.option}
                        type="button"
                        role="option"
                        onClick={() => choose(item)}
                      >
                        {optionLabel(item)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </form>
          {postError ? (
            <p className={ui.alert} role="alert">
              {postError}
            </p>
          ) : null}
          {selected && loading ? <p>Checking saved videos...</p> : null}
        </section>

        {hasVideos ? (
          <section className={styles.candidate}>
            <div className={styles.candidateBar}>
              <div>
                <h2>{optionLabel(selected)}</h2>
                <p>Videos already stored for this candidate are listed below.</p>
              </div>
              <button className={ui.primary} type="button" onClick={() => setUploadOpen((open) => !open)}>
                {uploadOpen ? 'Close' : 'New video'}
              </button>
            </div>
          </section>
        ) : null}

        {showUpload ? (
          <UploadPanel
            maxBytes={maxBytes}
            candidateId={selected.candidateId}
            onUploaded={loadVideos}
          />
        ) : null}

        {hasVideos ? (
          <VideoList
            videos={videos}
            loading={loading}
            error={error}
            onChange={loadVideos}
            candidateId={selected.candidateId}
          />
        ) : null}

        {selected && error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}
