import { describe, expect, it } from "vitest";

import styles from "../../index.css?raw";

describe("Order intake mobile visibility", () => {
  it("keeps the effective availability and its blocking reason visible", () => {
    expect(styles).not.toMatch(
      /(?:\.order-intake-description|\.order-intake-effective)[^{]*\{[^}]*display:\s*none/su,
    );
  });
});
