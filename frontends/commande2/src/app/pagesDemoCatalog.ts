import type { CatalogApi, EstablishmentPublic, PublicMenu } from "@surplasse/shared";

export type CatalogReadClient = Pick<
  CatalogApi,
  "getEstablishmentPublic" | "getPublishedMenu"
>;

export const pagesDemoEstablishment = {
  id: "demo-establishment-le-cormoran",
  name: "Le Cormoran",
  slug: "le-cormoran",
  acceptingOrders: true,
  address: "12 quai des Belges, 13001 Marseille",
} satisfies EstablishmentPublic;

export const pagesDemoMenu = {
  id: "demo-menu-le-cormoran",
  name: "Carte de démonstration",
  currency: "EUR",
  categories: [
    {
      id: "demo-category-starters",
      name: "Entrées",
      products: [
        {
          id: "demo-product-panisses",
          name: "Panisses croustillantes",
          description: "Frites de pois chiches, aïoli maison.",
          priceCents: 650,
          available: true,
          optionGroups: [],
        },
        {
          id: "demo-product-soup",
          name: "Soupe de poisson",
          description: "Rouille, croûtons et gruyère râpé.",
          priceCents: 850,
          available: false,
          optionGroups: [],
        },
      ],
    },
    {
      id: "demo-category-mains",
      name: "Plats",
      products: [
        {
          id: "demo-product-daube",
          name: "Daube provençale",
          description: "Bœuf mijoté au vin rouge, olives noires.",
          priceCents: 1850,
          available: true,
          optionGroups: [
            {
              id: "demo-group-side",
              name: "Accompagnement",
              minChoices: 1,
              maxChoices: 1,
              options: [
                {
                  id: "demo-option-polenta",
                  name: "Polenta crémeuse",
                  extraCostCents: 0,
                  available: true,
                },
                {
                  id: "demo-option-potatoes",
                  name: "Pommes grenaille",
                  extraCostCents: 0,
                  available: true,
                },
              ],
            },
          ],
        },
        {
          id: "demo-product-fish",
          name: "Loup grillé",
          description: "Fenouil confit, huile d'olive du moulin.",
          priceCents: 2200,
          available: true,
          optionGroups: [],
        },
      ],
    },
    {
      id: "demo-category-desserts",
      name: "Desserts",
      products: [
        {
          id: "demo-product-navettes",
          name: "Navettes maison",
          description: "Biscuits à la fleur d'oranger, recette de famille.",
          priceCents: 450,
          available: true,
          optionGroups: [],
        },
        {
          id: "demo-product-lemon-tart",
          name: "Tarte au citron",
          description: "Meringue flambée, citrons de Menton.",
          priceCents: 700,
          available: true,
          optionGroups: [],
        },
      ],
    },
  ],
} satisfies PublicMenu;

function assertFixtureSlug(slug: string): void {
  if (slug !== pagesDemoEstablishment.slug) {
    throw new Error("The Pages demo slug does not match its explicit catalog fixture.");
  }
}

export const pagesDemoCatalogApi: CatalogReadClient = {
  async getEstablishmentPublic({ slug }) {
    assertFixtureSlug(slug);
    return pagesDemoEstablishment;
  },
  async getPublishedMenu({ slug }) {
    assertFixtureSlug(slug);
    return pagesDemoMenu;
  },
};
