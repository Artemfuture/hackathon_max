import Button from '../components/Button.jsx';
import Lumi from '../components/Lumi.jsx';
import PlanPreview from '../components/PlanPreview.jsx';
import Screen from '../components/Screen.jsx';
import styles from './Screens.module.css';

export default function ConfirmScreen({ plan, onBack, onShare, onSkip }) {
  return (
    <Screen
      onBack={onBack}
      title="Все согласны?"
      titleWide
      subtitle="Отправьте план тому, с кем идете"
      surface="raised"
      footer={
        <>
          <Button onClick={onShare}>Поделиться</Button>
          <Button variant="secondary" onClick={onSkip}>
            Продолжить без согласия
          </Button>
        </>
      }
    >
      <PlanPreview plan={plan} />
      <Lumi
        pose="wait"
        size={84}
        bubble="Отправьте ссылку — когда друг нажмёт «Иду!», я сообщу в чате."
        className={styles.lumiHint}
      />
    </Screen>
  );
}
