/**
 * Centralized TanStack Query key factories (docs/developpement/conventions-react.md):
 * hierarchical arrays, resource root first, never built by hand in features.
 */
export const queryKeys = {
  establishment: (slug: string) => ["establishment", slug] as const,
  orderIntake: (establishmentId: string) =>
    ["establishment", establishmentId, "order-intake"] as const,
  menu: (establishmentSlug: string) => ["menu", establishmentSlug] as const,
  order: (orderId: string) => ["order", "detail", orderId] as const,
  orderList: (establishmentId: string) => ["order", "list", establishmentId] as const,
  session: () => ["session", "current"] as const,
};
