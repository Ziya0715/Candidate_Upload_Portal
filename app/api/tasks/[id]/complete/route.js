import { requireSession } from '@/lib/auth';
import { fail, httpError, jsonOk } from '@/lib/http';
import { completeTask } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
  try {
    await requireSession();
    const taskId = String((await params)?.id || '').trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(taskId)) throw httpError('That task was not found.', 404);
    const task = await completeTask(taskId);
    return jsonOk({ task });
  } catch (error) {
    return fail(error);
  }
}
