import { getProfile } from '../bridge.js';
import styles from './ProfileButton.module.css';

export default function ProfileButton({ onClick }) {
  const profile = getProfile();
  const letter = [...(profile?.name ?? '').trim()][0]?.toUpperCase();
  return (
    <button type="button" className={styles.button} onClick={onClick} aria-label="Профиль" data-tour="profile">
      {profile?.photo ? <img src={profile.photo} alt="" referrerPolicy="no-referrer" /> : <span>{letter ?? '☺'}</span>}
    </button>
  );
}
