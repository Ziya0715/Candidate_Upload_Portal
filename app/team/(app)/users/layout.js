import { redirect } from 'next/navigation';
import { getActor } from '@/lib/team/guard';

export default async function UsersLayout({ children }) {
  const actor = await getActor();
  if (!actor) redirect('/login');
  if (actor.role !== 'super_admin') redirect('/team');
  return children;
}
