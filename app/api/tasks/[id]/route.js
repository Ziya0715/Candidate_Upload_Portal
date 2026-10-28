import { requireSession } from '@/lib/auth';
import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { deleteTask, updateTask } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function taskIdFrom(params) {
  const taskId = String(params?.id || '').trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(taskId)) {
    throw httpError('That task was not found.', 404);
  }
  return taskId;
}

export async function PATCH(request, { params }) {
  try {
    await requireSession();
    const taskId = taskIdFrom(await params);
    const body = await readBody(request);
    const task = await updateTask(taskId, body);
    return jsonOk({ task });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireSession();
    const taskId = taskIdFrom(await params);
    const body = await readBody(request);
    const task = await deleteTask(taskId, body.reason);
    return jsonOk({ task });
  } catch (error) {
    return fail(error);
  }
}
