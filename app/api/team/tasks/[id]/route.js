import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { getTask, removeTask, updateTask } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function idFrom(params) {
  const id = String(params?.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError('That task was not found.', 404);
  return id;
}

export async function GET(_request, { params }) {
  try {
    const actor = await requireActor();
    return jsonOk(await getTask(actor, idFrom(await params)));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await updateTask(actor, idFrom(await params), await readBody(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await removeTask(actor, idFrom(await params)));
  } catch (error) {
    return fail(error);
  }
}
