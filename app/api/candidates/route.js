import { requireUploadDesk } from '@/lib/uploadGate';
import { normalizeCandidateId } from '@/lib/candidateId';
import { fail, httpError, jsonOk } from '@/lib/http';
import { findCandidates, suggestCandidates } from '@/lib/sheet';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    await requireUploadDesk();
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const suggest = url.searchParams.get('suggest') === '1';

    if (!query.trim()) {
      throw httpError('Enter a candidate ID or an ST name.');
    }

    if (suggest) {
      const rows = await suggestCandidates(query);
      const candidates = [];
      for (const row of rows) {
        const checked = normalizeCandidateId(row.candidateId);
        if (!checked.ok) continue;
        candidates.push({ candidateId: checked.candidateId, stName: row.stName });
      }
      return jsonOk({ candidates });
    }

    const found = await findCandidates({ query });
    const candidates = [];
    for (const row of found.candidates) {
      const checked = normalizeCandidateId(row.candidateId);
      if (!checked.ok) continue;
      candidates.push({ candidateId: checked.candidateId, stName: row.stName });
    }

    if (!candidates.length) {
      return jsonOk({ match: false, mode: found.mode, candidates: [] });
    }

    return jsonOk({ match: true, mode: found.mode, candidates });
  } catch (error) {
    return fail(error);
  }
}
