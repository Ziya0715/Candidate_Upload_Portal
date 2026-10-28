import { redirect } from 'next/navigation';
import { getActor, publicActor } from '@/lib/team/guard';
import Board from './Board';

export const dynamic = 'force-dynamic';

export default async function TasksPage({ searchParams }) {
  const actor = await getActor();
  if (!actor) redirect('/login');
  const params = await searchParams;
  const mine = actor.role === 'super_admin' ? false : params?.mine === '1' || actor.role === 'team_member';
  return <Board actor={publicActor(actor)} mine={mine} />;
}
