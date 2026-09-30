import Button from '../components/Button.jsx';
import CheckRow from '../components/CheckRow.jsx';
import Screen from '../components/Screen.jsx';
import { BENEFIT_OPTIONS } from '../data/options.js';
import styles from './Screens.module.css';

export default function BenefitsScreen({ benefits, onToggle, onBack, onNext }) {
  return (
    <Screen
      onBack={onBack}
      title="Есть ли льготы?"
      subtitle="Учтём их при подборе и покажем реальную стоимость событий"
      footer={
        <Button disabled={benefits.length === 0} onClick={onNext}>
          Собрать вечер
        </Button>
      }
    >
      <div className={styles.rows}>
        {BENEFIT_OPTIONS.map((option) => (
          <CheckRow
            key={option.id}
            icon={option.emoji}
            title={option.title}
            hint={option.hint}
            checked={benefits.includes(option.id)}
            onChange={() => onToggle(option.id)}
          />
        ))}
      </div>
    </Screen>
  );
}
