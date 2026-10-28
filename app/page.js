import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getActor } from '@/lib/team/guard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let actor = null;
  try {
    actor = await getActor();
  } catch {
    actor = null;
  }
  if (actor) redirect('/team');
  const session = await getSession();
  redirect(session ? '/dashboard' : '/login');
}
