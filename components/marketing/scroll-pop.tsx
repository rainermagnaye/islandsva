"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const IN_VIEW = { threshold: 0.22, rootMargin: "0px 0px -10% 0px" } as const;

function alreadyShowing(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  if (rect.height === 0) return false;
  const limit = window.innerHeight * 0.9;
  const visible = Math.min(rect.bottom, limit) - Math.max(rect.top, 0);
  return visible / rect.height >= 0.22;
}

/**
 * Plays the scroll pop once per block. A scroll-linked animation would scrub
 * with the scrollbar; this spring has to run on its own clock, the way the
 * reference site does when a card enters. Deferred until the browser is idle
 * so it never touches the DOM mid-hydration.
 */
export function ScrollPop() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | undefined;
    const root = document.documentElement;

    const arm = () => {
      const blocks = [...document.querySelectorAll<HTMLElement>(".reveal")];

      for (const el of blocks) {
        if (alreadyShowing(el)) el.classList.add("is-in", "pop-settled");
      }
      root.classList.add("pop-ready");

      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add("is-in");
          el.addEventListener("animationend", () => el.classList.add("pop-settled"), { once: true });
          observer?.unobserve(el);
        }
      }, IN_VIEW);

      for (const el of blocks) {
        if (!el.classList.contains("is-in")) observer.observe(el);
      }
    };

    const idle = window.requestIdleCallback?.(arm, { timeout: 250 });
    const timer = idle === undefined ? window.setTimeout(arm, 50) : undefined;

    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
      observer?.disconnect();
      root.classList.remove("pop-ready");
    };
  }, [pathname]);

  return null;
}
