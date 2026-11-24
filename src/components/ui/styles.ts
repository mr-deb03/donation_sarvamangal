import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Same variants and sizes as the main site's ButtonLink (components/ui/ButtonLink.tsx). */
const variants = {
  primary: "bg-crimson text-white shadow-[0_10px_24px_-10px_rgb(200_16_58/0.6)] hover:bg-crimson-deep",
  secondary: "bg-white text-ink ring-1 ring-inset ring-ink/15 hover:bg-paper-2 hover:ring-ink/35",
  marigold: "bg-marigold text-ink hover:brightness-105",
  "outline-light": "text-white ring-1 ring-inset ring-white/45 hover:bg-white/10",
  ghost: "text-ink hover:bg-ink/5",
} as const;

const sizes = {
  sm: "min-h-11 px-4 text-[0.95rem]",
  md: "min-h-12 px-6 text-base",
  lg: "min-h-14 px-7 text-[1.0625rem]",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold tracking-[0.005em]",
    "transition-[background-color,box-shadow,filter,transform] duration-200 motion-safe:active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    "[&_svg]:size-[1.15em] [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
  );
}

/**
 * The main site's form conventions (MASTER.md → Forms): labels above fields, a crimson *
 * on required ones, "(optional)" on the rest, errors under the field in crimson.
 */
export function inputClasses(invalid?: boolean) {
  return cn(
    "block min-h-12 w-full rounded-xl border bg-white px-4 text-base text-ink placeholder:text-pencil/80",
    "transition-[border-color,box-shadow] duration-150 outline-none",
    "focus:border-ink focus:ring-4 focus:ring-ink/10",
    "disabled:cursor-not-allowed disabled:bg-paper-2 disabled:text-ink-muted",
    invalid ? "border-crimson ring-crimson/10" : "border-ink/20 hover:border-ink/40",
  );
}

export const errorId = (id: string) => `${id}-error`;
export const hintId = (id: string) => `${id}-hint`;

/** aria props that tie an input to its hint and error. */
export function describedBy(id: string, { hint, error }: { hint?: ReactNode; error?: string }) {
  const ids = [hint ? hintId(id) : null, error ? errorId(id) : null].filter(Boolean).join(" ");
  return { "aria-describedby": ids || undefined, "aria-invalid": error ? true : undefined } as const;
}
