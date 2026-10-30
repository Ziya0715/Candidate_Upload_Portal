import { fail, jsonOk } from '@/lib/http';
import { listAttention } from '@/lib/team/data';
import { requireActor } from '@/lib/team/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireActor();
    return jsonOk({ alerts: await listAttention(actor) });
  } catch (error) {
    return fail(error);
  }
}
