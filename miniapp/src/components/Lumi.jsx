import hello from '../assets/lumi/hello.webp';
import curious from '../assets/lumi/curious.webp';
import think from '../assets/lumi/think.webp';
import found from '../assets/lumi/found.webp';
import lead from '../assets/lumi/lead.webp';
import wait from '../assets/lumi/wait.webp';
import together from '../assets/lumi/together.webp';
import joy from '../assets/lumi/joy.webp';
import fly from '../assets/lumi/fly.webp';
import glide from '../assets/lumi/glide.webp';
import sad from '../assets/lumi/sad.webp';
import { cx } from '../lib/format.js';
import styles from './Lumi.module.css';

export const LUMI_POSES = {
  hello,
  curious,
  think,
  found,
  lead,
  wait,
  together,
  joy,
  fly,
  glide,
  sad,
};

export default function Lumi({
  pose = 'hello',
  size = 96,
  float = false,
  bubble,
  side = 'right',
  className,
  alt = '',
}) {
  return (
    <div className={cx(styles.root, side === 'top' && styles.stack, className)}>
      {bubble && <p className={cx(styles.bubble, side === 'top' ? styles.bubbleTop : styles.bubbleRight)}>{bubble}</p>}
      <img
        key={pose}
        className={cx(styles.img, float && styles.float)}
        src={LUMI_POSES[pose] ?? LUMI_POSES.hello}
        width={size}
        alt={alt}
        draggable={false}
      />
    </div>
  );
}
