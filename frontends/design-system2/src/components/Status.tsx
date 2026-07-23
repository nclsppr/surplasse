import type { HTMLAttributes } from "react";

import { cx } from "../lib/cx";

export interface StatusProps extends HTMLAttributes<HTMLSpanElement> {
  state?: "connected" | "connecting" | "disconnected";
}

export function Status({ className, children, state = "connected", ...props }: StatusProps) {
  return (
    <span {...props} className={cx("ui2-status", `ui2-status-${state}`, className)} role="status">
      <span className="ui2-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("fr-FR"))
    .join("");
}
