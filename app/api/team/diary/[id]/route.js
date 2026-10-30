import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { removeDiary, updateDiary } from '@/lib/team/diary';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function idFrom(params) {
  const id = String(params?.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError('That diary entry was not found.', 404);
  return id;
}

export async function PATCH(request, { params }) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await updateDiary(actor, idFrom(await params), await readBody(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await removeDiary(actor, idFrom(await params), await readBody(request)));
  } catch (error) {
    return fail(error);
  }
}
