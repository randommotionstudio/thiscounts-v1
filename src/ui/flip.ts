import { useLayoutEffect, useRef } from 'react';

// Lets things travel to their new place instead of jumping ("FLIP"): capture() notes where every element marked
// with data-flip="<id>" sits (and how tall every data-flip-h="<id>" box is), the next render changes the layout,
// and each one then slides from its old place to the new one (boxes grow or shrink to their new height).

const DURATION_MS = 350;
const EASING = 'cubic-bezier(.2,.7,.2,1)';

function measure(root: HTMLElement) {
  const top = root.getBoundingClientRect().top - root.scrollTop;
  const pos = new Map<string, number>(), h = new Map<string, number>();
  root.querySelectorAll<HTMLElement>('[data-flip]').forEach(el => pos.set(el.dataset.flip!, el.getBoundingClientRect().top - top));
  root.querySelectorAll<HTMLElement>('[data-flip-h]').forEach(el => h.set(el.dataset.flipH!, el.getBoundingClientRect().height));
  return { pos, h };
}

export function useFlip<T extends HTMLElement>() {
  const root = useRef<T | null>(null);
  const before = useRef<ReturnType<typeof measure> | null>(null);
  useLayoutEffect(() => {
    const was = before.current;
    if (!was || !root.current) return;
    before.current = null;
    const now = measure(root.current);
    root.current.querySelectorAll<HTMLElement>('[data-flip]').forEach(el => {
      const a = was.pos.get(el.dataset.flip!), b = now.pos.get(el.dataset.flip!);
      if (a == null || b == null || Math.abs(a - b) < 1 || typeof el.animate !== 'function') return;
      el.animate([{ transform: `translateY(${a - b}px)` }, { transform: 'translateY(0)' }], { duration: DURATION_MS, easing: EASING });
    });
    root.current.querySelectorAll<HTMLElement>('[data-flip-h]').forEach(el => {
      const a = was.h.get(el.dataset.flipH!), b = now.h.get(el.dataset.flipH!);
      if (a == null || b == null || Math.abs(a - b) < 1 || typeof el.animate !== 'function') return;
      el.animate([{ height: a + 'px' }, { height: b + 'px' }], { duration: DURATION_MS, easing: EASING });
    });
  });
  return { root, capture: () => { if (root.current) before.current = measure(root.current); } };
}
