import { readJson } from '@/lib/readJson';

function putToSpaces(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Spaces refused the upload (${xhr.status}).`));
    };

    xhr.onerror = () => {
      reject(
        new Error(
          'The browser could not send the video to Spaces. Add https://candidate-upload-portal.vercel.app to the bucket CORS allowed origins, with methods GET, PUT, and HEAD, and header *.'
        )
      );
    };

    xhr.onabort = () => {
      reject(new Error('The upload was cancelled.'));
    };

    xhr.send(file);
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

  await putToSpaces(presign.uploadUrl, file, presign.contentType, onProgress);

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
