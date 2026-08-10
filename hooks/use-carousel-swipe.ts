"use client";

import { useCallback, useRef } from "react";

const SWIPE_MIN_PX = 48;

/** Swipe horizontal (touch + souris) pour carrousels d'images. */
export function useCarouselSwipe(
  enabled: boolean,
  onPrev: () => void,
  onNext: () => void,
) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const resolveSwipe = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled || !startRef.current) return;
      const dx = clientX - startRef.current.x;
      const dy = clientY - startRef.current.y;
      startRef.current = null;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) onNext();
      else onPrev();
    },
    [enabled, onNext, onPrev],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const t = e.touches[0];
      if (!t) return;
      startRef.current = { x: t.clientX, y: t.clientY };
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      resolveSwipe(t.clientX, t.clientY);
    },
    [resolveSwipe],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      startRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [enabled],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      resolveSwipe(e.clientX, e.clientY);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [resolveSwipe],
  );

  return { onTouchStart, onTouchEnd, onPointerDown, onPointerUp };
}
