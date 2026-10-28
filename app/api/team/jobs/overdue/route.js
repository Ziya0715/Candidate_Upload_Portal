import { fail, httpError, jsonOk } from '@/lib/http';
import { markOverdue } from '@/lib/team/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const secret = String(process.env.TEAM_JOB_SECRET || '').trim();
    if (!secret || request.headers.get('x-team-job-secret') !== secret) {
      throw httpError('This job was rejected.', 401);
    }
    const moved = await markOverdue();
    return jsonOk({ moved });
  } catch (error) {
    return fail(error);
  }
}
