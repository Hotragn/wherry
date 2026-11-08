"use client";

import { useEffect, useRef } from "react";

/**
 * Text-frame animation in Paper Mono. Writes straight to a <pre> (no React re-render per frame),
 * capped at `fps`, paused off-screen, static under prefers-reduced-motion, aria-hidden with a text alternative.
 * `duration` (ms) plays once and holds the last frame, then calls onDone.
 */
export function AsciiAnim({
  render,
  label,
  fps = 12,
  staticAt = 0,
  duration,
  onDone,
  className = "",
}: {
  render: (ms: number) => string;
  label: string;
  fps?: number;
  staticAt?: number;
  duration?: number;
  onDone?: () => void;
  className?: string;
}) {
  const pre = useRef<HTMLPreElement>(null);
  const renderRef = useRef(render);
  const doneRef = useRef(onDone);
  useEffect(() => {
    renderRef.current = render;
    doneRef.current = onDone;
  });

  useEffect(() => {
    const el = pre.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.textContent = renderRef.current(duration ?? staticAt);
      doneRef.current?.();
      return;
    }
    let raf = 0;
    let visible = true;
    let last = -Infinity;
    let elapsed = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      if (visible) elapsed += now - prev;
      prev = now;
      if (duration !== undefined && elapsed >= duration) {
        el.textContent = renderRef.current(duration);
        doneRef.current?.();
        return;
      }
      if (visible && now - last >= 1000 / fps) {
        last = now;
        el.textContent = renderRef.current(elapsed);
      }
      raf = requestAnimationFrame(tick);
    };
    el.textContent = renderRef.current(0);
    raf = requestAnimationFrame(tick);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [fps, staticAt, duration]);

  return (
    <div className={className}>
      <pre ref={pre} aria-hidden className="ascii" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

