/**
 * Interface strings, externalized from day one (conventions React). French
 * is the default and only language of the MVP; the i18n library choice is
 * deferred until a second language is needed.
 */
export const fr = {
  menu: {
    sessionLoading: "Ouverture de la carte...",
    loading: "Chargement de la carte...",
    error: "La carte n'a pas pu être chargée.",
    retry: "Réessayer",
    unavailable: "Épuisé",
    poweredBy: "Commande directe par Surplasse",
    add: "Ajouter",
    table: "Table",
    orderIntakeTitle: "Prise de commandes",
    orderIntakePaused: "En pause",
    orderIntakePausedDescription:
      "La carte reste disponible, mais le restaurant n’accepte pas de nouvelle commande ni de nouveau paiement pour le moment.",
    orderIntakePausedAction: "Commandes en pause",
    orderIntakeRefreshError:
      "La disponibilité n’a pas pu être actualisée. Elle sera vérifiée à nouveau au moment de valider votre commande.",
  },
  product: {
    notePlaceholder: "Une précision pour la cuisine ? (facultatif)",
    addToCart: "Ajouter au panier",
    cancel: "Annuler",
    close: "Fermer",
    required: "obligatoire",
    chooseUpTo: (max: number) => `jusqu'à ${max} choix`,
    orderIntakePaused:
      "La prise de commandes est en pause. Vos choix sont conservés, mais vous ne pouvez pas ajouter ce plat maintenant.",
  },
  cart: {
    title: "Votre commande",
    empty: "Votre panier est vide.",
    backToMenu: "Retour à la carte",
    total: "Total",
    checkout: "Commander",
    remove: "Retirer",
    decreaseQuantity: (productName: string) => `Diminuer la quantité de ${productName}`,
    increaseQuantity: (productName: string) => `Augmenter la quantité de ${productName}`,
    noSession: "Scannez le QR code de votre table pour commander sur place.",
    error: "La commande n'a pas pu être créée.",
    adjust: "Un produit n'est plus disponible : ajustez votre panier.",
    orderIntakePaused:
      "La prise de commandes vient d’être mise en pause. Votre panier est conservé, mais aucune nouvelle commande ni aucun nouveau paiement ne peut être lancé pour le moment.",
    orderIntakePausedNotice:
      "La prise de commandes est en pause. Votre panier est conservé ici, mais vous ne pouvez pas le valider pour le moment.",
    orderIntakeRefreshError:
      "La disponibilité n’a pas pu être actualisée. Elle sera vérifiée à nouveau lors de la validation.",
    checkingOrderIntake: "Vérification de la disponibilité…",
    checkoutPaused: "Commandes en pause",
  },
  payment: {
    title: "Paiement",
    loading: "Préparation du paiement...",
    pay: (amount: string) => `Payer ${amount}`,
    notConfigured:
      "Le paiement n'est pas configuré sur cet environnement de démonstration. Votre commande reste en attente de paiement.",
    failed: "Le paiement n'a pas abouti. Vous pouvez réessayer.",
    orderIntakePaused:
      "La prise de commandes vient d’être mise en pause. Aucun nouveau paiement ne peut démarrer. Un paiement Stripe déjà ouvert peut encore aboutir : vérifiez le suivi de la commande avant de recommencer.",
    retry: "Réessayer",
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
