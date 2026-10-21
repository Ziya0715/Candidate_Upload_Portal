import { getVideoByShareToken } from '@/lib/videos';
import WatchPlayer from './WatchPlayer';
import styles from './watch.module.scss';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { token } = await params;
  const video = await getVideoByShareToken(token);
  return {
    title: video ? video.filename : 'Video not found',
  };
}

export default async function WatchPage({ params }) {
  const { token } = await params;
  const video = await getVideoByShareToken(token);

  if (!video) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>This link does not work</h1>
          <p className={styles.note}>The video was removed, or the link is incomplete.</p>
        </section>
      </main>
    );
  }

  return <WatchPlayer token={token} filename={video.filename} />;
}
