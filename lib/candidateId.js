export const COURSE_VIDEO_FOLDER = 'course_Recored_videos';

export function normalizeCandidateId(value) {
  const candidateId = String(value || '').trim();

  if (!candidateId) {
    return { ok: false, error: 'Enter a candidate ID.' };
  }

  if (candidateId.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(candidateId)) {
    return {
      ok: false,
      error: 'Use letters, numbers, dots, hyphens, or underscores in the candidate ID.',
    };
  }

  return { ok: true, candidateId };
}

export function candidateFolder(candidateId) {
  return `${COURSE_VIDEO_FOLDER}/${candidateId}/`;
}
