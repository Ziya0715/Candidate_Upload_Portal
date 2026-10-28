import { fail, jsonOk, readBody } from '@/lib/http';
import { listTeams, saveTeam } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireActor();
    return jsonOk({ teams: await listTeams(actor) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await saveTeam(actor, await readBody(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
