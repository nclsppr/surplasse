import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrderBoard } from "./OrderBoard";

describe("OrderBoard", () => {
  it("renders one global empty state without status columns", () => {
    const html = renderToStaticMarkup(<OrderBoard establishmentId="establishment-id" orders={[]} />);

    expect(html.match(/class="board-empty"/g)).toHaveLength(1);
    expect(html).not.toContain("order-column");
  });
});
