import { fail, jsonOk } from '@/lib/http';
import { dashboardFor } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireActor();
    return jsonOk(await dashboardFor(actor));
  } catch (error) {
    return fail(error);
  }
}
