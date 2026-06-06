"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StagePanel = {
  key: string;
  short: string;
  count: number;
  node: ReactNode;
};

export function StageTabs({ panels }: { panels: StagePanel[] }) {
  const [active, setActive] = useState(panels[0]?.key);
  const current = panels.find((panel) => panel.key === active) ?? panels[0];

  // Tab / Shift+Tab cycle through the stages (unless you're typing in a field).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setActive((current) => {
        const index = panels.findIndex((panel) => panel.key === current);
        const length = panels.length;
        const next = event.shiftKey
          ? (index - 1 + length) % length
          : (index + 1) % length;
        return panels[next].key;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panels]);

  return (
    <>
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {panels.map((panel) => (
          <button
            key={panel.key}
            type="button"
            onClick={() => setActive(panel.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              panel.key === active
                ? "bg-neon text-base"
                : "bg-panel text-mute hover:text-ink",
            )}
          >
            {panel.short}
            <span className="ml-1.5 opacity-60">{panel.count}</span>
          </button>
        ))}
      </div>
      <div>{current?.node}</div>
    </>
  );
}
