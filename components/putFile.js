import { readJson } from '@/lib/readJson';

function postToSpaces(url, fields, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(fields).forEach(([name, value]) => form.append(name, value));
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    const finished = () => {
      if (xhr.status >= 400) {
        reject(new Error(`Spaces refused the upload (${xhr.status}).`));
        return;
      }
      resolve();
    };

    xhr.onload = finished;
    // A missing CORS header hides a successful save. The app checks the bucket next.
    xhr.onerror = () => resolve();
    xhr.onabort = () => {
      reject(new Error('The upload was cancelled.'));
    };

    xhr.send(form);
  });
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

  await postToSpaces(presign.upload.url, presign.upload.fields, file, onProgress);

  return readJson(
    await fetch('/api/videos/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId: presign.candidateId,
        videoId: presign.videoId,
        filename: presign.filename,
        size: file.size,
      }),
    })
  );
}
