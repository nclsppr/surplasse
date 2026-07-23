import type { HTMLAttributes } from "react";

import iconUrl from "../../../../brand/surplasse-app-icon.svg";
import logoUrl from "../../../../brand/surplasse-logo-horizontal.svg";
import { cx } from "../lib/cx";

export interface BrandProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
  tagline?: string;
}

export function Brand({ className, compact = false, tagline, ...props }: BrandProps) {
  return (
    <div {...props} className={cx("ui2-brand", compact && "ui2-brand-compact", className)}>
      <img
        className="ui2-brand-logo"
        src={compact ? iconUrl : logoUrl}
        alt="Surplasse"
        width={compact ? 1024 : 906}
        height={compact ? 1024 : 198}
      />
      {!compact && tagline ? <span className="ui2-brand-tagline">{tagline}</span> : null}
    </div>
  );
}
