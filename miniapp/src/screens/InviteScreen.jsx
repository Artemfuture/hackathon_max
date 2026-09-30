import Avatar from '../components/Avatar.jsx';
import Lumi from '../components/Lumi.jsx';
import Button from '../components/Button.jsx';
import Collage from '../components/Collage.jsx';
import Screen from '../components/Screen.jsx';
import { formatDuration, formatPrice, toClock } from '../lib/format.js';
import styles from './Screens.module.css';

export default function InviteScreen({ plan, name, dateLabel, onAccept, onDecline }) {
  return (
    <Screen
      bare
      surface="raised"
      footerGap={18}
      footerBottom={64}
      footer={
        <>
          <Button onClick={onAccept}>Иду!</Button>
          <Button variant="secondary" onClick={onDecline}>
            Не подходит
          </Button>
        </>
      }
    >
      <Avatar name={name} />
      <h1 className={styles.inviteTitle}>{name} приглашает вас на вечер</h1>
      <p className={styles.inviteAsk}>Пойдём?</p>

      <ul className={styles.facts}>
        <li>
          {dateLabel} в {toClock(plan.start)}
        </li>
        <li>{formatDuration(plan.durationMin)}</li>
        <li>{plan.price === 0 ? 'бесплатно' : `${formatPrice(plan.price)}/чел`}</li>
        <li>{plan.stops.map((stop) => stop.item.kind).join(' → ')}</li>
      </ul>

      <div className={styles.inviteCollage}>
        <Collage photos={plan.stops.map((stop) => ({ src: stop.item.photo, crop: stop.item.crop }))} />
      </div>
      <Lumi
        pose="wait"
        size={72}
        bubble="После «Иду!» покажу весь маршрут с дорогой между точками"
        className={styles.lumiHint}
      />
    </Screen>
  );
}
