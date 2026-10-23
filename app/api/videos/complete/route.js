import { requireSession } from '@/lib/auth';
import { normalizeCandidateId } from '@/lib/candidateId';
import { maxUploadBytes } from '@/lib/config';
import { checkVideo } from '@/lib/fileRules';
import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { buildStorageKey, deleteStoredObject, setStoredContentType, statObject } from '@/lib/spaces';
import { isVideoId, toPublicVideo, videoFromUpload } from '@/lib/videos';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    await requireSession();
    const body = await readBody(request);
    const videoId = body?.videoId;

    if (!isVideoId(videoId)) {
      throw httpError('That upload session is not valid. Please start again.');
    }

    const candidate = normalizeCandidateId(body?.candidateId);
    if (!candidate.ok) {
      throw httpError(candidate.error);
    }

    const checked = checkVideo({
      filename: body?.filename,
      size: body?.size,
      maxBytes: maxUploadBytes(),
    });

    if (!checked.ok) {
      throw httpError(checked.error);
    }

    const storageKey = buildStorageKey(candidate.candidateId, videoId, checked.storageName);
    const stored = await statObject(storageKey);

    if (!stored) {
      throw httpError(
        'The video did not finish saving. Please try the upload again.'
      );
    }

    if (Number(stored.ContentLength) !== checked.size) {
      await deleteStoredObject(storageKey);
      throw httpError('The uploaded file size did not match. Please try again.');
    }

    await setStoredContentType(storageKey, checked.contentType);

    const video = videoFromUpload({
      storageKey,
      sizeBytes: checked.size,
      contentType: checked.contentType,
      createdAt: stored.LastModified ? new Date(stored.LastModified).toISOString() : new Date().toISOString(),
    });

    if (!video) {
      throw httpError('The uploaded file could not be read from Spaces.', 502);
    }

    return jsonOk({ video: toPublicVideo(video) }, 201);
  } catch (error) {
    return fail(error);
  }
}
