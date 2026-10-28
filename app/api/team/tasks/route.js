import { fail, jsonOk, readBody } from '@/lib/http';
import { createTask, listTasks } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const filters = Object.fromEntries(url.searchParams.entries());
    return jsonOk(await listTasks(actor, filters));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await createTask(actor, await readBody(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
