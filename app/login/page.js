import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getActor } from '@/lib/team/guard';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in',
};

export default async function LoginPage() {
  let actor = null;
  try {
    actor = await getActor();
  } catch {
    actor = null;
  }
  if (actor) redirect('/team');
  const session = await getSession();
  if (session) redirect('/dashboard');
  return <LoginForm />;
}
