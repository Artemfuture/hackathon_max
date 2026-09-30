import Chip from './Chip.jsx';
import backArrow from '../assets/icon-back.svg';
import { cx } from '../lib/format.js';
import styles from './Screen.module.css';

export default function Screen({
  city,
  headerLeft,
  headerRight,
  onBack,
  kicker,
  title,
  titleSize = 'lg',
  titleWide = false,
  subtitle,
  subtitleGap,
  surface = 'base',
  bare = false,
  tabBar = false,
  footer,
  footerGap,
  footerBottom,
  children,
}) {
  const px = (value) => (value == null ? undefined : `${value}px`);
  const vars = {
    '--subtitle-gap': px(subtitleGap),
    '--footer-gap': px(footerGap),
    '--footer-bottom': px(footerBottom),
  };

  return (
    <div className={cx(styles.root, surface === 'raised' && styles.raised, tabBar && styles.withTabBar)} style={vars}>
      <main className={cx(styles.column, bare && styles.bare)}>
        {!bare && (
          <>
            {(onBack || city || headerLeft || headerRight) && (
              <header className={styles.top}>
                {onBack && (
                  <button type="button" className={styles.back} onClick={onBack} aria-label="Назад">
                    <img src={backArrow} width="19.5" height="22.09" alt="" />
                  </button>
                )}
                {!onBack && headerLeft}
                <div className={styles.right}>{headerRight ?? (city && <Chip>{city}</Chip>)}</div>
              </header>
            )}

            {kicker && <p className={styles.kicker}>{kicker}</p>}
            {title && (
              <h1
                className={cx(
                  styles.title,
                  titleSize === 'md' && styles.titleMd,
                  titleSize === 'sm' && styles.titleSm,
                  titleWide && styles.wide,
                  !(onBack || city || headerLeft || headerRight || kicker) && styles.titleTop
                )}
              >
                {title}
              </h1>
            )}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </>
        )}

        {children}
      </main>

      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  );
}
