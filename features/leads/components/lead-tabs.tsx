"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";

export type LeadTab = { href: string; label: string; current: boolean; icon: IconName };

/** Same current-item treatment as the admin menu: card surface, secondary text, small elevation, radius-md. */
const tabClasses =
  "inline-flex min-h-11 items-center gap-2 rounded-md px-3 type-label whitespace-nowrap text-ink-muted no-underline transition-colors duration-150 hover:bg-action-ghost-hover hover:text-ink aria-[current=page]:bg-surface-card aria-[current=page]:text-action-secondary aria-[current=page]:elevation-sm";

type Line = { x: number; w: number };

/** Survives the tab navigation, so the accent line can travel from the tab you left. */
let previousLine: Line | null = null;

function measure(nav: HTMLElement): Line | null {
  const active = nav.querySelector<HTMLElement>("[aria-current='page']");
  if (!active) return null;
  const from = nav.getBoundingClientRect();
  const to = active.getBoundingClientRect();
  return { x: to.left - from.left, w: to.width };
}

/**
 * The design-system tab bar: the current tab is a tinted chip, and the accent line slides to it.
 * The line is placed before the first paint, then allowed to move, so it doesn't fly in from the corner.
 */
export function LeadTabs({ label, tabs }: { label: string; tabs: readonly LeadTab[] }) {
  const navRef = useRef<HTMLElement>(null);
  const [line, setLine] = useState<Line | null>(previousLine);
  const [slide, setSlide] = useState(false);
  const current = tabs.find((tab) => tab.current)?.href;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const next = measure(nav);
    if (!next) return;
    const from = previousLine;
    let frame = 0;
    if (from && (from.x !== next.x || from.w !== next.w)) {
      setSlide(false);
      setLine(from);
      frame = requestAnimationFrame(() => {
        setSlide(true);
        setLine(next);
        previousLine = next;
      });
    } else {
      setLine(next);
      previousLine = next;
      frame = requestAnimationFrame(() => setSlide(true));
    }
    return () => cancelAnimationFrame(frame);
  }, [current]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => {
      const next = measure(nav);
      if (!next) return;
      previousLine = next;
      setLine(next);
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  return (
    <nav ref={navRef} aria-label={label} className="relative border-b border-border">
      <ul className="m-0 flex list-none gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none]">
        {tabs.map((tab) => (
          <li key={tab.label}>
            <Link href={tab.href} aria-current={tab.current ? "page" : undefined} className={tabClasses}>
              <Icon name={tab.icon} size={18} />
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
      <span
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute bottom-0 left-0 h-0.5 bg-action-secondary",
          slide && "transition-[transform,width] duration-300 ease-out motion-reduce:transition-none",
        )}
        style={{ width: line?.w ?? 0, transform: `translateX(${line?.x ?? 0}px)` }}
      />
    </nav>
  );
}
