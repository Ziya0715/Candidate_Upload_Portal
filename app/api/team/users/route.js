import { fail, jsonOk, readBody } from '@/lib/http';
import { listUsers, saveUser } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    return jsonOk({
      users: await listUsers(actor, {
        q: url.searchParams.get('q') || '',
        teamId: url.searchParams.get('teamId') || '',
        assignable: url.searchParams.get('assignable') === '1',
      }),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await saveUser(actor, await readBody(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
