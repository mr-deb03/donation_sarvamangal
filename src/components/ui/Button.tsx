import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { buttonClasses, type ButtonSize, type ButtonVariant } from "./styles";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks, keeping the label readable. */
  loading?: boolean;
  children: ReactNode;
};

export function Button({ variant, size, loading, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses(variant, size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<"a"> & { variant?: ButtonVariant; size?: ButtonSize };

export function LinkButton({ variant, size, className, ...rest }: LinkButtonProps) {
  return <a className={cn(buttonClasses(variant, size), className)} {...rest} />;
}
