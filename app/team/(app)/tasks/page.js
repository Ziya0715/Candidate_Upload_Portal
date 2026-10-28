import { redirect } from 'next/navigation';
import { getActor, publicActor } from '@/lib/team/guard';
import Board from './Board';

export const dynamic = 'force-dynamic';

export default async function TasksPage({ searchParams }) {
  const actor = await getActor();
  if (!actor) redirect('/login');
  const params = await searchParams;
  const mine = actor.role === 'team_member' || (params?.mine === '1' && actor.role !== 'super_admin' && actor.role !== 'team_leader');
  return <Board actor={publicActor(actor)} mine={mine} />;
}
