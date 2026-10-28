import { fail, jsonOk } from '@/lib/http';
import { activityFor } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireActor();
    return jsonOk({ activity: await activityFor(actor) });
  } catch (error) {
    return fail(error);
  }
}
