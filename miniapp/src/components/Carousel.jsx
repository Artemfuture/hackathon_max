import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Carousel.module.css';

export default function Carousel({ title, children, tour }) {
  const scroller = useRef(null);
  const drag = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    setEdges({
      start: node.scrollLeft <= 4,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    update();
    const node = scroller.current;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [update, children]);

  const step = (direction) => {
    const node = scroller.current;
    const card = node.firstElementChild;
    const width = card ? card.getBoundingClientRect().width + 15 : node.clientWidth * 0.8;
    node.scrollBy({ left: direction * width, behavior: 'smooth' });
  };

  const onPointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = { x: event.clientX, left: scroller.current.scrollLeft, moved: false };
    scroller.current.style.scrollSnapType = 'none';
  };
  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (Math.abs(dx) > 4) state.moved = true;
    scroller.current.scrollLeft = state.left - dx;
  };
  const onPointerUp = () => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    scroller.current.style.scrollSnapType = '';
    if (state?.moved) {
      const swallow = (event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    }
  };

  const scrollable = !(edges.start && edges.end);

  return (
    <section className={styles.section} data-tour={tour}>
      {(title || scrollable) && (
        <div className={styles.head}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {scrollable && (
            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrow}
                aria-label="Назад по ленте"
                disabled={edges.start}
                onClick={() => step(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.arrow}
                aria-label="Дальше по ленте"
                disabled={edges.end}
                onClick={() => step(1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
      <div
        ref={scroller}
        className={styles.scroller}
        onScroll={update}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {children}
      </div>
    </section>
  );
}
