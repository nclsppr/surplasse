import {
  Input,
  Label,
  Text,
  TextField,
  type TextFieldProps,
} from "react-aria-components";

import { cx } from "../lib/cx";

export interface FieldProps extends Omit<TextFieldProps, "children" | "className"> {
  label: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  className?: string;
}

export function Field({
  className,
  description,
  errorMessage,
  label,
  placeholder,
  ...props
}: FieldProps) {
  return (
    <TextField {...props} className={cx("ui2-field", className)}>
      <Label className="ui2-field-label">{label}</Label>
      <Input className="ui2-input" placeholder={placeholder} />
      {description ? (
        <Text className="ui2-field-description" slot="description">
          {description}
        </Text>
      ) : null}
      {errorMessage ? (
        <Text className="ui2-field-error" slot="errorMessage">
          {errorMessage}
        </Text>
      ) : null}
    </TextField>
  );
}
