"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Instant, app-themed tooltip. Positioned with `fixed` from the trigger's rect
// so it appears immediately on hover (no native delay) and is never clipped by
// the bracket's horizontal-scroll container.
export function HoverTip({
  label,
  content,
  className,
  style,
  children,
}: {
  label?: string | null;
  content?: ReactNode; // rich tooltip body; takes precedence over `label`
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const body = content ?? label;

  function show() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }

  return (
    <span
      ref={ref}
      className={className}
      style={style}
      onMouseEnter={body ? show : undefined}
      onMouseLeave={() => setPos(null)}
      onFocus={body ? show : undefined}
      onBlur={() => setPos(null)}
    >
      {children}
      {body && pos && (
        <span
          role="tooltip"
          style={{ position: "fixed", left: pos.x, top: pos.y - 8 }}
          className={cn(
            "pointer-events-none z-50 max-w-[80vw] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] font-medium text-ink shadow-lg shadow-black/50",
            content ? "" : "whitespace-nowrap",
          )}
        >
          {body}
        </span>
      )}
    </span>
  );
}
