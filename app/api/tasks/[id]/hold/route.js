import { requireSession } from '@/lib/auth';
import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { holdTask } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    await requireSession();
    const taskId = String((await params)?.id || '').trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(taskId)) throw httpError('That task was not found.', 404);
    const body = await readBody(request);
    const task = await holdTask(taskId, body.reason);
    return jsonOk({ task });
  } catch (error) {
    return fail(error);
  }
}
