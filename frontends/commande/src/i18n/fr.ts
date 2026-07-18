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
    add: "Ajouter",
    table: "Table",
  },
  product: {
    notePlaceholder: "Une précision pour la cuisine ? (facultatif)",
    addToCart: "Ajouter au panier",
    cancel: "Annuler",
    required: "obligatoire",
    chooseUpTo: (max: number) => `jusqu'à ${max} choix`,
  },
  cart: {
    title: "Votre commande",
    empty: "Votre panier est vide.",
    backToMenu: "Retour à la carte",
    total: "Total",
    checkout: "Commander",
    remove: "Retirer",
    noSession: "Scannez le QR code de votre table pour commander sur place.",
    error: "La commande n'a pas pu être créée.",
    adjust: "Un produit n'est plus disponible : ajustez votre panier.",
  },
  payment: {
    title: "Paiement",
    loading: "Préparation du paiement...",
    pay: (amount: string) => `Payer ${amount}`,
    notConfigured:
      "Le paiement n'est pas configuré sur cet environnement de démonstration. Votre commande reste en attente de paiement.",
    failed: "Le paiement n'a pas abouti. Vous pouvez réessayer.",
    seeOrder: "Voir ma commande",
  },
  tracking: {
    title: "Suivi de votre commande",
    orderNumber: "Commande",
    total: "Total",
    error: "Cette commande est introuvable.",
    statuses: {
      pending_payment: "En attente de paiement",
      paid: "Reçue",
      accepted: "Acceptée",
      preparing: "En préparation",
      ready: "Prête",
      served: "Servie",
      picked_up: "Retirée",
      cancelled: "Annulée",
      refunded: "Remboursée",
    } as Record<string, string>,
  },
} as const;
