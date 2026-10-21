export function uploadVideo({ candidateId, file, filename, contentType, onProgress }) {
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
      reject(new Error('The upload did not reach the server. Check your connection and try again.'));
    };

    xhr.onabort = () => {
      reject(new Error('The upload was cancelled.'));
    };

    xhr.send(file);
  });
}
