/**
 * Interface strings, externalized from day one (conventions React). French
 * is the default and only language of the MVP; the i18n library choice is
 * deferred until a second language is needed.
 */
export const fr = {
  menu: {
    loading: "Chargement de la carte...",
    error: "La carte n'a pas pu être chargée.",
    retry: "Réessayer",
    unavailable: "Épuisé",
    poweredBy: "Commande directe par Surplasse",
  },
} as const;
