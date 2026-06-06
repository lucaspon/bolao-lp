import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-neon text-base font-semibold hover:brightness-110 disabled:opacity-50",
  outline:
    "border border-line text-ink hover:border-neon/60 hover:text-neon disabled:opacity-50",
  ghost: "text-mute hover:text-ink hover:bg-panel2 disabled:opacity-50",
  danger: "border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "primary", size = "md", className, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/50",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
