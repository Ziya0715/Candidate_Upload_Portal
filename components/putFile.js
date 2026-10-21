import { readJson } from '@/lib/readJson';

function postToSpaces(url, fields, file) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.name = `spaces-upload-${Date.now()}`;
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.enctype = 'multipart/form-data';
    form.target = iframe.name;
    form.hidden = true;

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'file';
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    form.appendChild(fileInput);

    let finished = false;
    const cleanup = () => {
      form.remove();
      iframe.remove();
    };
    const done = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve();
    };

    // The first load is the empty frame. The next load is Spaces accepting the file.
    iframe.addEventListener('load', () => {
      iframe.onload = () => done();
      form.submit();
    });

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    window.setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('The upload took too long. Please try that video again.'));
    }, 60 * 60 * 1000);
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

  await postToSpaces(presign.upload.url, presign.upload.fields, file);
  onProgress(100);

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
