"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export type Side = "home" | "away";
type Mode = "browse" | "edit";

type PillHandle = {
  id: number;
  element: HTMLElement;
  editable: boolean;
  adjust: (side: Side, delta: number) => void;
  setScore: (side: Side, value: number) => void;
  save: () => void;
  clear: () => void;
};

type KeyboardContext = {
  selectedId: number | null;
  mode: Mode;
  activeSide: Side;
  register: (handle: PillHandle) => () => void;
  select: (id: number) => void;
};

const Ctx = createContext<KeyboardContext | null>(null);

// --- Geometry: pick the nearest pill in a direction --------------------------
function center(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function firstElement(elements: HTMLElement[]): HTMLElement | null {
  return (
    elements
      .slice()
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return ra.top - rb.top || ra.left - rb.left;
      })[0] ?? null
  );
}

function nextInDirection(
  current: HTMLElement,
  elements: HTMLElement[],
  dir: "up" | "down" | "left" | "right",
): HTMLElement | null {
  const c = center(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of elements) {
    if (el === current) continue;
    const p = center(el);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    let along: number;
    let across: number;
    if (dir === "right") {
      if (dx <= 1) continue;
      along = dx;
      across = Math.abs(dy);
    } else if (dir === "left") {
      if (dx >= -1) continue;
      along = -dx;
      across = Math.abs(dy);
    } else if (dir === "down") {
      if (dy <= 1) continue;
      along = dy;
      across = Math.abs(dx);
    } else {
      if (dy >= -1) continue;
      along = -dy;
      across = Math.abs(dx);
    }
    const score = along + across * 3; // strongly prefer staying aligned
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function KeyboardBetProvider({ children }: { children: ReactNode }) {
  const registry = useRef(new Map<number, PillHandle>());
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("browse");
  const [activeSide, setActiveSide] = useState<Side>("home");

  const register = useCallback((handle: PillHandle) => {
    registry.current.set(handle.id, handle);
    return () => {
      registry.current.delete(handle.id);
      setSelectedId((current) => (current === handle.id ? null : current));
    };
  }, []);

  const select = useCallback((id: number) => {
    setMode("browse");
    setSelectedId(id);
  }, []);

  function liveElements(): HTMLElement[] {
    return [...registry.current.values()]
      .filter((handle) => handle.element.isConnected)
      .map((handle) => handle.element);
  }

  function idOf(element: HTMLElement): number | null {
    for (const handle of registry.current.values()) {
      if (handle.element === element) return handle.id;
    }
    return null;
  }

  function focusElement(element: HTMLElement) {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    const isDigit = key.length === 1 && key >= "0" && key <= "9";
    const isClear = key === "Delete" || key === "Backspace";
    if (
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(key) &&
      !isDigit &&
      !isClear
    ) {
      return;
    }

    const target = event.target as HTMLElement;
    const onPill = !!target.closest("[data-bet-pill]");
    const onRoot = target === rootRef.current;
    if (!onPill && !onRoot) return; // ignore keys on tab buttons etc.

    // While typing in an input (mouse path), let the input handle keys.
    const typing = target.tagName === "INPUT";
    if (typing && mode !== "edit") return;

    const current = selectedId != null ? registry.current.get(selectedId) : null;

    if (mode === "edit") {
      if (!current) {
        setMode("browse");
        return;
      }
      event.preventDefault();
      if (isClear) {
        current.clear();
      } else if (isDigit) {
        // Type a digit to set the active side, then jump to the other side.
        current.setScore(activeSide, Number(key));
        setActiveSide(activeSide === "home" ? "away" : "home");
      } else if (key === "ArrowLeft") setActiveSide("home");
      else if (key === "ArrowRight") setActiveSide("away");
      else if (key === "ArrowUp") current.adjust(activeSide, 1);
      else if (key === "ArrowDown") current.adjust(activeSide, -1);
      else if (key === "Enter") {
        current.save();
        setMode("browse");
      } else if (key === "Escape") setMode("browse");
      return;
    }

    // browse mode
    if (key === "Escape" || isDigit) return;
    if (isClear) {
      if (current?.editable) {
        event.preventDefault();
        current.clear();
      }
      return;
    }
    if (key === "Enter") {
      if (current?.editable) {
        event.preventDefault();
        setMode("edit");
        setActiveSide("home");
        focusElement(current.element);
      }
      return;
    }

    event.preventDefault();
    const elements = liveElements();
    if (elements.length === 0) return;

    if (!current) {
      const first = firstElement(elements);
      const id = first ? idOf(first) : null;
      if (first && id != null) {
        setSelectedId(id);
        focusElement(first);
      }
      return;
    }

    const dir = key.replace("Arrow", "").toLowerCase() as "up" | "down" | "left" | "right";
    const next = nextInDirection(current.element, elements, dir);
    if (next) {
      const id = idOf(next);
      if (id != null) {
        setSelectedId(id);
        focusElement(next);
      }
    }
  }

  // Focus the grid on mount so arrow keys work right away.
  useEffect(() => {
    if (rootRef.current && !rootRef.current.contains(document.activeElement)) {
      rootRef.current.focus({ preventScroll: true });
    }
  }, []);

  return (
    <Ctx.Provider value={{ selectedId, mode, activeSide, register, select }}>
      <div ref={rootRef} tabIndex={0} onKeyDown={onKeyDown} className="outline-none">
        {children}
      </div>
    </Ctx.Provider>
  );
}

// Used by each pill: registers itself (via the pill's own ref) and reports its
// selection state. Returns only plain values, so it's safe to read in render.
export function usePillKeyboard(
  ref: { current: HTMLElement | null },
  args: {
    id: number;
    editable: boolean;
    adjust: (side: Side, delta: number) => void;
    setScore: (side: Side, value: number) => void;
    save: () => void;
    clear: () => void;
  },
) {
  const ctx = useContext(Ctx);
  const register = ctx?.register;
  const adjustRef = useRef(args.adjust);
  const setScoreRef = useRef(args.setScore);
  const saveRef = useRef(args.save);
  const clearRef = useRef(args.clear);

  // Keep the latest handlers without re-registering each render.
  useEffect(() => {
    adjustRef.current = args.adjust;
    setScoreRef.current = args.setScore;
    saveRef.current = args.save;
    clearRef.current = args.clear;
  });

  // Depend only on the stable `register` callback — not the whole context value,
  // which changes on every selection and would churn the registration.
  useEffect(() => {
    const element = ref.current;
    if (!register || !element) return;
    return register({
      id: args.id,
      element,
      editable: args.editable,
      adjust: (side, delta) => adjustRef.current(side, delta),
      setScore: (side, value) => setScoreRef.current(side, value),
      save: () => saveRef.current(),
      clear: () => clearRef.current(),
    });
  }, [register, ref, args.id, args.editable]);

  return {
    select: ctx?.select,
    selected: ctx?.selectedId === args.id,
    editing: ctx?.selectedId === args.id && ctx?.mode === "edit",
    activeSide: ctx?.activeSide ?? ("home" as Side),
  };
}
