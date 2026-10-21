import Link from 'next/link';
import styles from './message.module.scss';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Page not found</h1>
        <p>That address is not part of Video Share.</p>
        <p>
          <Link href="/login">Staff login</Link>
        </p>
      </section>
    </main>
  );
}
