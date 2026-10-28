import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { saveTeam, setTeamLeader } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function idFrom(params) {
  const id = String(params?.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError('That team was not found.', 404);
  return id;
}

export async function PATCH(request, { params }) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    const id = idFrom(await params);
    const body = await readBody(request);
    if (Object.prototype.hasOwnProperty.call(body, 'leaderId')) return jsonOk(await setTeamLeader(actor, id, body.leaderId || null));
    return jsonOk(await saveTeam(actor, body, id));
  } catch (error) {
    return fail(error);
  }
}
