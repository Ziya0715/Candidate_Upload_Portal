import { requireUploadDesk } from '@/lib/uploadGate';
import { normalizeCandidateId } from '@/lib/candidateId';
import { fail, httpError, jsonOk } from '@/lib/http';
import { deleteStoredObject } from '@/lib/spaces';
import { getVideo } from '@/lib/videos';

export const runtime = 'nodejs';

export async function DELETE(request, { params }) {
  try {
    await requireUploadDesk();
    const { id } = await params;
    const candidate = normalizeCandidateId(new URL(request.url).searchParams.get('candidateId'));
    if (!candidate.ok) {
      throw httpError(candidate.error);
    }

    const video = await getVideo(candidate.candidateId, id);
    if (!video) {
      throw httpError('That video is no longer in the list.', 404);
    }

    await deleteStoredObject(video.storageKey);
    return jsonOk({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
