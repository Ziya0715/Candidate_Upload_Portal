import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import TaskBoard from './TaskBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tasks',
};

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <TaskBoard username={session.username} />;
}
