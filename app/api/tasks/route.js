import { requireSession } from '@/lib/auth';
import { fail, jsonOk, readBody } from '@/lib/http';
import { createTask, listTasks } from '@/lib/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireSession();
    const tasks = await listTasks();
    return jsonOk({ tasks });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    await requireSession();
    const body = await readBody(request);
    const task = await createTask(body);
    return jsonOk({ task }, 201);
  } catch (error) {
    return fail(error);
  }
}
