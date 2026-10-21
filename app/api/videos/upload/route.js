import { requireSession } from '@/lib/auth';
import { normalizeCandidateId } from '@/lib/candidateId';
import { maxUploadBytes } from '@/lib/config';
import { checkVideo } from '@/lib/fileRules';
import { fail, httpError, jsonOk } from '@/lib/http';
import { buildStorageKey, deleteStoredObject, statObject, uploadStoredObject } from '@/lib/spaces';
import { createVideoId, toPublicVideo, videoFromUpload } from '@/lib/videos';

export const runtime = 'nodejs';

export async function POST(request) {
  let storageKey = '';

  try {
    await requireSession();
    const candidate = normalizeCandidateId(request.headers.get('x-candidate-id'));
    if (!candidate.ok) {
      throw httpError(candidate.error);
    }

    const filenameHeader = request.headers.get('x-filename') || '';
    let filename = filenameHeader;
    try {
      filename = decodeURIComponent(filenameHeader);
    } catch {
      filename = filenameHeader;
    }

    const size = Number(request.headers.get('content-length'));
    const checked = checkVideo({
      filename,
      size,
      maxBytes: maxUploadBytes(),
    });
    if (!checked.ok) {
      throw httpError(checked.error);
    }

    if (!request.body) {
      throw httpError('The upload was empty.');
    }

    const videoId = createVideoId();
    storageKey = buildStorageKey(candidate.candidateId, videoId, checked.storageName);

    await uploadStoredObject({
      storageKey,
      contentType: checked.contentType,
      body: request.body,
      contentLength: checked.size,
    });

    const stored = await statObject(storageKey);
    if (!stored || Number(stored.ContentLength) !== checked.size) {
      await deleteStoredObject(storageKey);
      throw httpError('The file did not finish saving in Spaces. Please try again.', 502);
    }

    const video = videoFromUpload({
      storageKey,
      sizeBytes: checked.size,
      contentType: checked.contentType,
      createdAt: stored.LastModified ? new Date(stored.LastModified).toISOString() : new Date().toISOString(),
    });

    if (!video) {
      await deleteStoredObject(storageKey);
      throw httpError('The uploaded file could not be read from Spaces.', 502);
    }

    return jsonOk({ video: toPublicVideo(video) }, 201);
  } catch (error) {
    if (storageKey) {
      await deleteStoredObject(storageKey).catch((cleanupError) => {
        console.error(cleanupError);
      });
    }
    return fail(error);
  }
}
