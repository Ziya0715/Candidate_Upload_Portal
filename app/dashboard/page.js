import { redirect } from 'next/navigation';
import { maxUploadBytes, spacesConfigured } from '@/lib/config';
import { uploadDeskPageAccess } from '@/lib/uploadGate';
import Dashboard from './Dashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Upload desk',
};

export default async function DashboardPage() {
  const access = await uploadDeskPageAccess();
  if (access?.denied) redirect('/team');
  if (!access) redirect('/login');

  return (
    <Dashboard
      username={access.username}
      maxBytes={maxUploadBytes()}
      spacesReady={spacesConfigured()}
    />
  );
}
