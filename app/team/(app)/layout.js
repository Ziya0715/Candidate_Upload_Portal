import { redirect } from 'next/navigation';
import TeamShell from '@/components/team/TeamShell';
import { teamConfigured } from '@/lib/team/db';
import { getActor, publicActor } from '@/lib/team/guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Work Flow' };

export default async function TeamLayout({ children }) {
  if (!teamConfigured()) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Team Management is not connected</h1>
        <p>Add DATABASE_URL and run npm run team:setup. The upload desk is still at /dashboard.</p>
      </main>
    );
  }
  let actor;
  try {
    actor = await getActor();
  } catch {
    return (
      <main style={{ padding: 24 }}>
        <h1>Team Management could not reach the database</h1>
        <p>The upload desk was not changed.</p>
      </main>
    );
  }
  if (!actor) redirect('/login');
  return <TeamShell actor={publicActor(actor)}>{children}</TeamShell>;
}
