import { useLayoutEffect, useRef } from 'react';

// Lets rows travel to their new place instead of jumping ("FLIP"): capture() notes where every element marked with
// data-flip="<id>" sits, the next render moves them, and each one then slides from its old place to the new one.

const DURATION_MS = 350;

function positions(root: HTMLElement) {
  const top = root.getBoundingClientRect().top - root.scrollTop;
  const m = new Map<string, number>();
  root.querySelectorAll<HTMLElement>('[data-flip]').forEach(el => m.set(el.dataset.flip!, el.getBoundingClientRect().top - top));
  return m;
}

export function useFlip<T extends HTMLElement>() {
  const root = useRef<T | null>(null);
  const before = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const was = before.current;
    if (!was || !root.current) return;
    before.current = null;
    const now = positions(root.current);
    root.current.querySelectorAll<HTMLElement>('[data-flip]').forEach(el => {
      const a = was.get(el.dataset.flip!), b = now.get(el.dataset.flip!);
      if (a == null || b == null || Math.abs(a - b) < 1 || typeof el.animate !== 'function') return;
      el.animate([{ transform: `translateY(${a - b}px)` }, { transform: 'translateY(0)' }], { duration: DURATION_MS, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
  });
  return { root, capture: () => { if (root.current) before.current = positions(root.current); } };
}
