import { readJson } from '@/lib/readJson';

async function postToSpaces(url, fields, file) {
  const form = new FormData();
  Object.entries(fields).forEach(([name, value]) => form.append(name, value));
  form.append('file', file);

  // no-cors lets the browser finish the save even when Spaces hides the reply.
  await fetch(url, { method: 'POST', mode: 'no-cors', body: form });
}

function uploadThroughApp({ candidateId, file, filename, contentType, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload');
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('X-Candidate-Id', candidateId);
    xhr.setRequestHeader('X-Filename', encodeURIComponent(filename));

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300 && data.video) {
        resolve(data);
        return;
      }

      const error = new Error(data.error || 'The upload failed.');
      error.status = xhr.status;
      reject(error);
    };

    xhr.onerror = () => {
      reject(
        new Error(
          'The video is too large for the live site to receive. Refresh and try again so the file can go straight to Spaces.'
        )
      );
    };

    xhr.onabort = () => {
      reject(new Error('The upload was cancelled.'));
    };

    xhr.send(file);
  });
}

export async function uploadVideo({ candidateId, file, filename, contentType, onProgress }) {
  const host = window.location.hostname;
  const sendDirect = host.endsWith('vercel.app');

  if (!sendDirect) {
    return uploadThroughApp({ candidateId, file, filename, contentType, onProgress });
  }

  const presign = await readJson(
    await fetch('/api/videos/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId,
        filename,
        size: file.size,
      }),
    })
  );

  await postToSpaces(presign.upload.url, presign.upload.fields, file);
  onProgress(100);

  const completeBody = {
    candidateId: presign.candidateId,
    videoId: presign.videoId,
    filename: presign.filename,
    size: file.size,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch('/api/videos/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completeBody),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.video) return data;

    const missing = response.status === 400 && String(data.error || '').includes('did not finish saving');
    if (!missing || attempt === 4) {
      const error = new Error(data.error || 'The upload failed.');
      error.status = response.status;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('The upload failed.');
}
