import { twMerge } from "tailwind-merge";

export function cx(...values: Array<string | false | null | undefined>): string {
  return twMerge(values.filter(Boolean).join(" "));
}
