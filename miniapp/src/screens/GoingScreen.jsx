import Button from '../components/Button.jsx';
import Lumi from '../components/Lumi.jsx';
import PlanPreview from '../components/PlanPreview.jsx';
import Screen from '../components/Screen.jsx';
import styles from './Screens.module.css';

export default function GoingScreen({ plan, name, onBack, onOpenPlan }) {
  return (
    <Screen
      onBack={onBack}
      surface="raised"
      title={
        <>
          {name}
          <br />
          идёт!
        </>
      }
      subtitle="Вечер сложится."
      subtitleGap={20}
      footerBottom={58}
      footer={<Button onClick={onOpenPlan}>Открыть план</Button>}
    >
      <PlanPreview plan={plan} collageGap={35} tone="dark" />
      <Lumi pose="together" size={96} bubble="Вместе веселее! Вечер сложится." className={styles.lumiHint} />
    </Screen>
  );
}
