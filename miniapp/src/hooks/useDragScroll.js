import { useEffect } from 'react';

export function useDragScroll(ref, shown = true) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let drag = null;

    const onDown = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { x: event.clientX, left: node.scrollLeft, moved: false };
    };
    const onMove = (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      if (drag.moved) node.scrollLeft = drag.left - dx;
    };
    const onUp = () => {
      if (!drag) return;
      const { moved } = drag;
      drag = null;
      if (!moved) return;
      const swallow = (click) => {
        click.stopPropagation();
        click.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    const onWheel = (event) => {
      if (node.scrollWidth <= node.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      node.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    node.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      node.removeEventListener('wheel', onWheel);
    };
  }, [ref, shown]);
}
