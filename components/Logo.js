import styles from './Logo.module.scss';

export default function Logo({ large = false }) {
  return (
    <span className={large ? styles.large : styles.mark} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22">
        <polygon points="8,5 19,12 8,19" fill="currentColor" />
      </svg>
    </span>
  );
}
