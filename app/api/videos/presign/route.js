import { requireSession } from '@/lib/auth';
import { normalizeCandidateId } from '@/lib/candidateId';
import { maxUploadBytes } from '@/lib/config';
import { checkVideo } from '@/lib/fileRules';
import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { buildStorageKey, createUploadForm } from '@/lib/spaces';
import { createVideoId } from '@/lib/videos';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    await requireSession();
    const body = await readBody(request);
    const candidate = normalizeCandidateId(body?.candidateId);
    if (!candidate.ok) {
      throw httpError(candidate.error);
    }

    const videoId = createVideoId();

    const checked = checkVideo({
      filename: body?.filename,
      size: body?.size,
      maxBytes: maxUploadBytes(),
    });

    if (!checked.ok) {
      throw httpError(checked.error);
    }

    const storageKey = buildStorageKey(candidate.candidateId, videoId, checked.storageName);
    const upload = await createUploadForm({
      storageKey,
      size: checked.size,
    });

    return jsonOk({
      videoId,
      candidateId: candidate.candidateId,
      filename: checked.filename,
      contentType: checked.contentType,
      upload,
    });
  } catch (error) {
    return fail(error);
  }
}
