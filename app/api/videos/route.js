import { requireUploadDesk } from '@/lib/uploadGate';
import { normalizeCandidateId } from '@/lib/candidateId';
import { fail, httpError, jsonOk } from '@/lib/http';
import { listVideos, toPublicVideo } from '@/lib/videos';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    await requireUploadDesk();
    const candidateId = new URL(request.url).searchParams.get('candidateId');
    const checked = normalizeCandidateId(candidateId);
    if (!checked.ok) {
      throw httpError(checked.error);
    }

    const videos = await listVideos(checked.candidateId);
    return jsonOk({
      candidateId: checked.candidateId,
      videos: videos.map(toPublicVideo),
    });
  } catch (error) {
    return fail(error);
  }
}
