'use client';

import styles from './message.module.scss';
import ui from '@/components/ui.module.scss';

export default function AppError({ reset }) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Something went wrong</h1>
        <p>Refresh the page. If you are setting the app up, check the terminal for the details.</p>
        <button className={ui.primary} type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
