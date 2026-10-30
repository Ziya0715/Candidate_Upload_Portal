import { fail, jsonOk, readBody } from '@/lib/http';
import { listDiary, saveDiary } from '@/lib/team/diary';
import { requireActor } from '@/lib/team/guard';
import { assertTeamWrite } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireActor();
    return jsonOk(await listDiary(actor));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    assertTeamWrite(request);
    const actor = await requireActor();
    return jsonOk(await saveDiary(actor, await readBody(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
