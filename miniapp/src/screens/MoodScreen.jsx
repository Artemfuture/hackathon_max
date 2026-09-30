import Button from '../components/Button.jsx';
import CheckRow from '../components/CheckRow.jsx';
import Screen from '../components/Screen.jsx';
import { getCatalog } from '../data/catalog.js';
import { MOOD_ANY } from '../data/options.js';
import styles from './Screens.module.css';

export default function MoodScreen({ moods, onToggle, onBack, onNext }) {
  const options = [...getCatalog().moods, MOOD_ANY];
  return (
    <Screen
      onBack={onBack}
      title="Как хочется провести время?"
      subtitle="Можно выбрать несколько"
      footer={
        <Button disabled={moods.length === 0} onClick={onNext}>
          Продолжить
        </Button>
      }
    >
      <div className={styles.rows}>
        {options.map((mood) => (
          <CheckRow
            key={mood.id}
            icon={mood.emoji}
            title={mood.label}
            hint={mood.hint}
            checked={moods.includes(mood.id)}
            onChange={() => onToggle(mood.id)}
          />
        ))}
      </div>
    </Screen>
  );
}
