import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../lib/cx";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
}

export function Badge({ className, children, dot = false, icon, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span {...props} className={cx("ui2-badge", `ui2-badge-${tone}`, className)}>
      {dot ? <span className="ui2-badge-dot" aria-hidden="true" /> : null}
      {icon ? <span className="ui2-badge-icon">{icon}</span> : null}
      {children}
    </span>
  );
}
