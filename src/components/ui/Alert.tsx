import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const tones = {
  info: { box: "bg-paper-2 text-ink-soft ring-line", icon: Info, iconClass: "text-ink-muted" },
  success: { box: "bg-success-soft text-ink ring-success/25", icon: CircleCheck, iconClass: "text-success" },
  warning: { box: "bg-marigold-soft/60 text-ink ring-marigold/50", icon: TriangleAlert, iconClass: "text-crimson-deep" },
  error: { box: "bg-crimson/[0.06] text-ink ring-crimson/30", icon: CircleAlert, iconClass: "text-crimson" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-2xl p-4 ring-1 ring-inset", t.box, className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", t.iconClass)} aria-hidden />
      <div className="min-w-0 text-[0.95rem] leading-relaxed">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}
