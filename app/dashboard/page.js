import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { maxUploadBytes, spacesConfigured } from '@/lib/config';
import Dashboard from './Dashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Upload desk',
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Dashboard
      username={session.username}
      maxBytes={maxUploadBytes()}
      spacesReady={spacesConfigured()}
    />
  );
}
