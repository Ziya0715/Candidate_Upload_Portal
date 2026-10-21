import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Staff login',
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');
  return <LoginForm />;
}
