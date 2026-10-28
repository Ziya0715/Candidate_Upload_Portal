'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ui from './ui.module.scss';
import styles from './SideNav.module.scss';

const LINKS = [
  { href: '/team', label: 'Work Flow' },
  { href: '/dashboard', label: 'Upload desk' },
];

export default function SideNav({ username, signingOut, onLogout }) {
  const pathname = usePathname();

  return (
    <aside className={styles.nav}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="3.5" width="6.2" height="4.6" rx="1.2" fill="currentColor" />
            <rect x="14.8" y="3.5" width="6.2" height="4.6" rx="1.2" fill="currentColor" />
            <rect x="8.9" y="15.9" width="6.2" height="4.6" rx="1.2" fill="currentColor" />
            <path d="M6.1 8.1v2.6c0 1.2 1 2.2 2.2 2.2h7.4c1.2 0 2.2-1 2.2-2.2V8.1M12 12.9v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <strong>Work Flow</strong>
      </div>
      <nav className={styles.links} aria-label="Main">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? styles.active : styles.link}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.foot}>
        <span>{username}</span>
        <button className={ui.ghost} type="button" onClick={onLogout} disabled={signingOut}>
          {signingOut ? 'Signing out...' : 'Log out'}
        </button>
      </div>
    </aside>
  );
}
