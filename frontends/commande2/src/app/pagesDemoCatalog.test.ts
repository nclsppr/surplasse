import { describe, expect, it } from "vitest";

import {
  pagesDemoCatalogApi,
  pagesDemoEstablishment,
  pagesDemoMenu,
} from "./pagesDemoCatalog";

describe("Pages catalog fixture", () => {
  it("provides an explicit synthetic establishment and menu", async () => {
    const request = { slug: pagesDemoEstablishment.slug };

    await expect(pagesDemoCatalogApi.getEstablishmentPublic(request)).resolves.toBe(
      pagesDemoEstablishment,
    );
    await expect(pagesDemoCatalogApi.getPublishedMenu(request)).resolves.toBe(pagesDemoMenu);
    expect(pagesDemoMenu.categories.length).toBeGreaterThan(0);
  });

  it("refuses a slug that is not the configured fixture", async () => {
    await expect(
      pagesDemoCatalogApi.getEstablishmentPublic({ slug: "another-establishment" }),
    ).rejects.toThrow("explicit catalog fixture");
  });
});
