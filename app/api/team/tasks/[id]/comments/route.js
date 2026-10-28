import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { addComment } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    const id = String((await params)?.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError('That task was not found.', 404);
    const body = await readBody(request);
    return jsonOk(await addComment(actor, id, body.comment));
  } catch (error) {
    return fail(error);
  }
}
