import type { ReactNode } from "react";
import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";

import { cx } from "../lib/cx";

export type ButtonColor = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<AriaButtonProps, "children"> {
  children: ReactNode;
  color?: ButtonColor;
  size?: ButtonSize;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  isLoading?: boolean;
}

export function Button({
  children,
  className,
  color = "primary",
  size = "md",
  iconLeading,
  iconTrailing,
  isDisabled,
  isLoading = false,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      isDisabled={isDisabled || isLoading}
      className={composeRenderProps(className, (resolvedClassName) =>
        cx("ui2-button", `ui2-button-${color}`, `ui2-button-${size}`, resolvedClassName),
      )}
    >
      {iconLeading ? <span className="ui2-button-icon">{iconLeading}</span> : null}
      {isLoading ? <span className="ui2-spinner ui2-spinner-small" aria-hidden="true" /> : null}
      <span>{children}</span>
      {iconTrailing ? <span className="ui2-button-icon">{iconTrailing}</span> : null}
    </AriaButton>
  );
}
