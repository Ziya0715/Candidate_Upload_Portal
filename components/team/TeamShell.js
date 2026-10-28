'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ui from '@/components/ui.module.scss';
import { ROLE_LABELS, teamFetch } from './client';
import styles from './team.module.scss';

function Nav({ actor }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const mine = search.get('mine') === '1';
  const links = [
    { href: '/team', label: 'Dashboard', exact: true },
    { href: '/team/tasks?mine=1', label: 'My Tasks', path: '/team/tasks', mine: true, roles: ['team_member'] },
    { href: '/team/tasks', label: actor.role === 'super_admin' ? 'Work Flow' : 'Team Tasks', path: '/team/tasks', roles: ['super_admin', 'team_leader'] },
    { href: '/team/users', label: 'Users', roles: ['super_admin'] },
    // { href: '/team/reports', label: 'Reports', roles: ['super_admin', 'team_leader'] },
    { href: '/team/activity', label: 'Activity Logs' },
    { href: '/team/settings', label: 'Settings' },
  ].filter((link) => !link.roles || link.roles.includes(actor.role));

  async function logout() {
    await teamFetch('/api/team/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className={styles.nav}>
      <strong className={styles.brand}>Work Flow</strong>
      <nav className={styles.links}>
        {links.map((link) => {
          const path = link.path || link.href;
          const active = link.exact
            ? pathname === path
            : pathname === path && (link.mine ? mine : link.path ? !mine : true);
          return (
            <Link key={link.href} href={link.href} className={active ? styles.active : styles.link}>
              {link.label}
            </Link>
          );
        })}
        {actor.uploadDesk ? <Link href="/dashboard" className={styles.link}>Upload desk</Link> : null}
      </nav>
      <div className={styles.foot}>
        <strong>{actor.name}</strong>
        <span className={styles.muted}>{ROLE_LABELS[actor.role]}</span>
        <button className={ui.ghost} type="button" onClick={logout}>Log out</button>
      </div>
    </aside>
  );
}

export default function TeamShell({ actor, children }) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <Nav actor={actor} />
      </Suspense>
      <div className={styles.main}>{children}</div>
    </div>
  );
}
