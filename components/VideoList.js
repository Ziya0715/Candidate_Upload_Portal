'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBytes } from '@/lib/fileRules';
import { readJson } from '@/lib/readJson';
import ui from './ui.module.scss';
import styles from './VideoList.module.scss';

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function shareUrl(token) {
  return `${window.location.origin}/v/${token}`;
}

export default function VideoList({ videos, loading, error, onChange, candidateId }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState('');
  const [manualLink, setManualLink] = useState(null);
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!copiedId) return undefined;
    const timer = setTimeout(() => setCopiedId(''), 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape' || deleting) return;
      setDeleteTarget(null);
      setPreview(null);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleting]);

  function leaveIfNeeded(requestError) {
    if (requestError.status === 401) {
      router.replace('/login');
      return true;
    }
    return false;
  }

  async function copyLink(video) {
    const link = shareUrl(video.shareToken);
    setActionError('');
    try {
      await navigator.clipboard.writeText(link);
      setManualLink(null);
      setCopiedId(video.id);
    } catch {
      setCopiedId('');
      setManualLink({ id: video.id, link });
      setActionError('Could not copy automatically. Select the link below and copy it.');
    }
  }

  async function openPreview(video) {
    setActionError('');
    setPreview({ filename: video.filename, url: '', loading: true, error: '' });
    try {
      const data = await readJson(
        await fetch(`/api/videos/${video.id}/preview?candidateId=${encodeURIComponent(candidateId)}`)
      );
      setPreview({ filename: data.filename, url: data.url, loading: false, error: '' });
    } catch (previewError) {
      if (leaveIfNeeded(previewError)) return;
      setPreview({
        filename: video.filename,
        url: '',
        loading: false,
        error: previewError.message,
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError('');
    try {
      await readJson(
        await fetch(`/api/videos/${deleteTarget.id}?candidateId=${encodeURIComponent(candidateId)}`, {
          method: 'DELETE',
        })
      );
      setDeleteTarget(null);
      await onChange();
    } catch (deleteError) {
      if (!leaveIfNeeded(deleteError)) {
        setActionError(deleteError.message);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <h2>Videos for {candidateId}</h2>
        <p>Anyone with a copied link can watch that video. Delete the video to turn the link off.</p>
      </div>

      {loading ? <p className={styles.loading}>Loading videos...</p> : null}
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className={ui.alert} role="alert">
          {actionError}
        </p>
      ) : null}

      {manualLink ? (
        <label className={styles.manual}>
          <span>Share link</span>
          <input readOnly value={manualLink.link} onFocus={(event) => event.target.select()} />
        </label>
      ) : null}

      {!loading && videos.length === 0 ? (
        <p className={styles.empty}>No videos for this candidate yet. Upload one above.</p>
      ) : null}

      <ul className={styles.list}>
        {videos.map((video) => (
          <li className={styles.row} key={video.id}>
            <div>
              <p className={styles.name}>{video.filename}</p>
              <p className={styles.meta}>
                <time dateTime={video.createdAt}>{formatWhen(video.createdAt)}</time>
                {' · '}
                {formatBytes(video.sizeBytes)}
              </p>
            </div>
            <div className={styles.actions}>
              <button className={ui.ghost} type="button" onClick={() => copyLink(video)}>
                {copiedId === video.id ? 'Copied' : 'Copy link'}
              </button>
              <button className={ui.ghost} type="button" onClick={() => openPreview(video)}>
                Preview
              </button>
              <button className={ui.danger} type="button" onClick={() => setDeleteTarget(video)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {deleteTarget ? (
        <div className={styles.backdrop} onClick={() => (deleting ? null : setDeleteTarget(null))}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-title">Delete this video?</h3>
            <p>
              {deleteTarget.filename} will be removed. The share link will stop working.
            </p>
            <div className={styles.dialogActions}>
              <button
                className={ui.ghost}
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button className={ui.danger} type="button" disabled={deleting} onClick={confirmDelete}>
                {deleting ? 'Deleting...' : 'Delete video'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className={styles.backdrop} onClick={() => setPreview(null)}>
          <div
            className={styles.preview}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="preview-title">{preview.filename}</h3>
            {preview.loading ? <p>Preparing preview...</p> : null}
            {preview.error ? (
              <p className={ui.alert} role="alert">
                {preview.error}
              </p>
            ) : null}
            {preview.url ? (
              <video
                className={styles.player}
                src={preview.url}
                controls
                playsInline
                preload="metadata"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div className={styles.dialogActions}>
              <button className={ui.ghost} type="button" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
