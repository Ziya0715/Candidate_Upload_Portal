import { fail, jsonOk, readBody } from '@/lib/http';
import { changeOwnPassword } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    const body = await readBody(request);
    return jsonOk(await changeOwnPassword(actor, body.currentPassword, body.nextPassword));
  } catch (error) {
    return fail(error);
  }
}
