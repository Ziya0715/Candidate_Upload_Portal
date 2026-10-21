import { fail, httpError, jsonOk } from '@/lib/http';
import { createPlaybackUrl } from '@/lib/spaces';
import { getVideoByShareToken } from '@/lib/videos';

export const runtime = 'nodejs';

// This route is public on purpose. The signed token is the permission.
export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    const video = await getVideoByShareToken(token);

    if (!video) {
      throw httpError('This link does not work. The video was removed or the link is incomplete.', 404);
    }

    const url = await createPlaybackUrl({
      storageKey: video.storageKey,
      contentType: video.contentType,
    });

    return jsonOk({
      filename: video.filename,
      contentType: video.contentType,
      url,
    });
  } catch (error) {
    return fail(error);
  }
}
