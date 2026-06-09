"use client";

import { useRef, useState, type ReactNode } from "react";

// Instant, app-themed tooltip. Positioned with `fixed` from the trigger's rect
// so it appears immediately on hover (no native delay) and is never clipped by
// the bracket's horizontal-scroll container.
export function HoverTip({
  label,
  className,
  children,
}: {
  label?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function show() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={label ? show : undefined}
      onMouseLeave={() => setPos(null)}
      onFocus={label ? show : undefined}
      onBlur={() => setPos(null)}
    >
      {children}
      {label && pos && (
        <span
          role="tooltip"
          style={{ position: "fixed", left: pos.x, top: pos.y - 8 }}
          className="pointer-events-none z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] font-medium text-ink shadow-lg shadow-black/50"
        >
          {label}
        </span>
      )}
    </span>
  );
}
