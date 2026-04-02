"use client";

import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down" | null;

/**
 * Определяет направление скролла внутри ref-элемента.
 *
 * @param scrollRef - ref на scrollable контейнер
 * @param threshold - минимальное смещение (px) для срабатывания (default 10)
 * @returns "up" | "down" | null
 */
export function useScrollDirection(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  threshold = 10,
): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>(null);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const currentScrollTop = el.scrollTop;
      const diff = currentScrollTop - lastScrollTop.current;

      if (Math.abs(diff) < threshold) return;

      setDirection(diff > 0 ? "down" : "up");
      lastScrollTop.current = currentScrollTop;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollRef, threshold]);

  return direction;
}
