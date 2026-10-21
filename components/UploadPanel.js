'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACCEPT_ATTRIBUTE, checkVideo, formatBytes } from '@/lib/fileRules';
import { uploadVideo } from './putFile';
import ui from './ui.module.scss';
import styles from './UploadPanel.module.scss';

export default function UploadPanel({ maxBytes, candidateId, onUploaded }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [fileLabel, setFileLabel] = useState('');
  const [position, setPosition] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState('');

  async function uploadAll(files) {
    const accepted = [];
    const rejected = [];

    files.forEach((file) => {
      const checked = checkVideo({ filename: file.name, size: file.size, maxBytes });
      if (checked.ok) {
        accepted.push({ file, checked });
      } else {
        rejected.push({
          id: `invalid-${rejected.length}-${file.name}`,
          filename: file.name,
          error: checked.error,
        });
      }
    });

    if (accepted.length === 0) {
      setSuccess('');
      setResults(rejected);
      setError('None of those files can be uploaded.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');
    setCopiedId('');
    setResults(rejected);
    setPosition({ current: 0, total: accepted.length });

    const saved = [];
    let stopped = false;

    for (let index = 0; index < accepted.length; index += 1) {
      const { file, checked } = accepted[index];
      setPosition({ current: index + 1, total: accepted.length });
      setFileLabel(checked.filename);
      setProgress(0);
      setPhase('uploading');

      try {
        const response = await uploadVideo({
          candidateId,
          file,
          filename: checked.filename,
          contentType: checked.contentType,
          onProgress: setProgress,
        });
        const link = `${window.location.origin}/v/${response.video.shareToken}`;
        saved.push({
          id: response.video.id,
          filename: response.video.filename,
          link,
        });
        setResults((current) => [
          ...current,
          { id: response.video.id, filename: response.video.filename, link },
        ]);
        await onUploaded();
      } catch (uploadError) {
        if (uploadError.status === 401) {
          router.replace('/login');
          stopped = true;
          break;
        }
        setResults((current) => [
          ...current,
          {
            id: `${checked.filename}-${index}`,
            filename: checked.filename,
            error: uploadError.message || 'The upload failed.',
          },
        ]);
      }
    }

    if (!stopped) {
      const failed = accepted.length - saved.length + rejected.length;
      if (saved.length === 0) {
        setError(`No videos were saved for candidate ${candidateId}.`);
      } else if (failed > 0) {
        setSuccess(`${saved.length} saved for candidate ${candidateId}. ${failed} could not be uploaded.`);
      } else {
        setSuccess(
          saved.length === 1
            ? `${saved[0].filename} is saved for candidate ${candidateId}.`
            : `${saved.length} videos are saved for candidate ${candidateId}.`
        );
      }
    }

    setBusy(false);
    setPhase('');
    setPosition({ current: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = '';
  }

  function takeFiles(fileList) {
    if (busy) return;
    const files = Array.from(fileList || []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;
    uploadAll(files);
  }

  function statusText() {
    const count =
      position.total > 1 ? `File ${position.current} of ${position.total}. ` : '';
    if (phase === 'uploading' && progress === 0) {
      return `${count}Uploading ${fileLabel}... please wait`;
    }
    if (phase === 'uploading') return `${count}Uploading ${fileLabel}... ${progress}%`;
    return '';
  }

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <h2>Upload videos</h2>
        <p>
          Saved in course_Recored_videos/{candidateId}/. Choose one video or several. They are added to
          this candidate folder, even when it already exists. Up to {formatBytes(maxBytes)} each.
        </p>
      </div>

      <div
        className={dragging ? styles.dragging : styles.zone}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          takeFiles(event.dataTransfer.files);
        }}
      >
        <strong>Drag and drop videos here</strong>
        <p>or</p>
        <button
          className={ui.primary}
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          className={styles.fileInput}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          onChange={(event) => takeFiles(event.target.files)}
        />
      </div>

      {phase ? (
        <div className={styles.status} aria-live="polite">
          <p>{statusText()}</p>
          <div
            className={styles.track}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Upload progress"
          >
            <span className={styles.bar} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className={ui.success}>{success}</p> : null}

      {results.length > 0 ? (
        <ul className={styles.queue}>
          {results.map((item) => (
            <li className={styles.item} key={item.id}>
              <p className={styles.itemName}>{item.filename}</p>
              {item.error ? <p className={styles.failed}>{item.error}</p> : null}
              {item.link ? (
                <div className={styles.itemActions}>
                  <input readOnly value={item.link} onFocus={(event) => event.target.select()} />
                  <button
                    className={ui.ghost}
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(item.link);
                        setCopiedId(item.id);
                      } catch {
                        setCopiedId('');
                      }
                    }}
                  >
                    {copiedId === item.id ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
