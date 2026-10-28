import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { saveUser } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    const id = String((await params)?.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError('That user was not found.', 404);
    return jsonOk(await saveUser(actor, await readBody(request), id));
  } catch (error) {
    return fail(error);
  }
}
