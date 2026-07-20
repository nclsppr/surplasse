export const fr = {
  brand: {
    name: "Surplasse",
    tagline: "Le circuit court de la commande.",
  },
  common: {
    retry: "Réessayer",
    loading: "Chargement…",
  },
  auth: {
    eyebrow: "Espace restaurateur",
    loginTitle: "Heureux de vous revoir",
    loginDescription: "Recevez un lien de connexion sécurisé, sans mot de passe.",
    emailLabel: "Adresse email",
    emailPlaceholder: "vous@restaurant.fr",
    submit: "Recevoir mon lien",
    submitting: "Envoi en cours…",
    requestSuccess:
      "Si cette adresse correspond à un compte, un lien de connexion vient d’être envoyé. Pensez à vérifier vos courriers indésirables.",
    requestError: "Le lien n’a pas pu être demandé. Vérifiez votre connexion puis réessayez.",
    exchangeTitle: "Connexion sécurisée",
    exchangePending: "Vérification de votre lien…",
    exchangeMissing: "Ce lien de connexion est incomplet.",
    exchangeError: "Ce lien est invalide ou a déjà été utilisé.",
    backToLogin: "Demander un nouveau lien",
    sessionLoadingTitle: "Ouverture du service",
    sessionLoadingDescription: "Nous retrouvons votre espace restaurateur.",
    sessionErrorTitle: "Impossible de retrouver votre session",
    sessionErrorDescription: "Vérifiez votre connexion avant de réessayer.",
  },
  service: {
    eyebrow: "Service en cours",
    title: "Commandes opérationnelles",
    establishmentLabel: "Établissement",
    refresh: "Actualiser",
    refreshing: "Actualisation…",
    updatedAt: (time: string) => `Mis à jour à ${time}`,
    live: {
      connecting: "Connexion au direct",
      connected: "Temps réel actif",
      reconnecting: "Reconnexion au direct",
    },
    logout: "Se déconnecter",
    logoutError: "La déconnexion a échoué. Réessayez.",
    noEstablishmentTitle: "Aucun établissement accessible",
    noEstablishmentDescription:
      "Votre compte est bien connecté, mais aucun établissement ne lui est encore rattaché. Contactez l’équipe Surplasse.",
    orderCount: (count: number) => `${count} commande${count === 1 ? "" : "s"} en cours`,
    loadMore: "Charger les commandes suivantes",
    loadingMore: "Chargement…",
    loadingOrders: "Chargement des commandes…",
    ordersErrorTitle: "Les commandes ne sont pas disponibles",
    ordersErrorDescription:
      "La connexion avec Surplasse a été interrompue. Aucune donnée affichée n’a été modifiée.",
    ordersStaleWarning:
      "L’actualisation a échoué. Les commandes affichées proviennent de la dernière lecture réussie.",
    emptyBoard: "Aucune commande en cours pour cet établissement.",
    boardLabel: "Commandes regroupées par statut",
    orderIntake: {
      eyebrow: "Pendant le service",
      title: "Prise de commandes",
      open: "Ouverte",
      paused: "En pause",
      effectiveLabel: "Disponibilité réelle",
      effectiveOpen: "Active",
      effectiveBlocked: "Bloquée",
      loading: "Lecture de l’état de la prise de commandes…",
      unavailable: "L’état de la prise de commandes n’est pas disponible.",
      openDescription:
        "Les clients peuvent créer une commande et lancer un nouveau paiement.",
      pausedDescription:
        "La carte reste visible. Les nouvelles commandes et les nouveaux paiements sont bloqués. Les paiements Stripe déjà ouverts peuvent encore aboutir.",
      inactiveDescription:
        "L’établissement n’est pas actif. Les nouvelles commandes restent bloquées tant qu’il n’est pas réactivé.",
      paymentsUnavailableDescription:
        "La configuration Stripe ne permet pas d’accepter de nouveaux paiements pour le moment.",
      configurationUnavailableDescription:
        "Il faut une carte publiée et au moins une table active pour accepter de nouvelles commandes.",
      pauseAction: "Mettre en pause",
      openAction: "Rouvrir la prise de commandes",
      opening: "Ouverture…",
      pausing: "Mise en pause…",
      confirmTitle: "Mettre la prise de commandes en pause ?",
      confirmDescription:
        "Les nouvelles commandes et les nouveaux paiements seront bloqués. Une commande dont le paiement Stripe est déjà lancé peut encore être débitée. Il faudra alors la servir ou la rembourser.",
      confirmBlockedDescription:
        "Les nouvelles commandes sont déjà bloquées par la configuration. La pause empêchera leur réouverture automatique quand le prérequis reviendra. Une commande dont le paiement Stripe est déjà lancé peut encore être débitée. Il faudra alors la servir ou la rembourser.",
      confirmAction: "Confirmer la pause",
      cancel: "Annuler",
      staleWarning: "L’actualisation de cet état a échoué. Le dernier état connu reste affiché.",
      openPrerequisitesError:
        "La réouverture est impossible tant que l’établissement, la carte publiée, les tables actives ou Stripe ne sont pas prêts. Vérifiez ces prérequis puis réessayez.",
      openEstablishmentInactiveError:
        "L’établissement doit être actif avant de rouvrir la prise de commandes.",
      openConfigurationError:
        "Publiez une carte et activez au moins une table avant de rouvrir la prise de commandes.",
      openPaymentsError:
        "Stripe Connect doit pouvoir accepter les paiements avant de rouvrir la prise de commandes.",
      updateUncertainError:
        "Le serveur n’a pas confirmé le changement. Vérifiez l’indicateur d’état ci-dessus. S’il est signalé comme ancien, actualisez-le avant de réessayer.",
    },
    columns: {
      paid: {
        title: "Nouvelles",
        description: "Payées, à prendre en charge",
        empty: "Aucune nouvelle commande",
      },
      accepted: {
        title: "Acceptées",
        description: "Confirmées par l’équipe",
        empty: "Aucune commande acceptée",
      },
      preparing: {
        title: "En préparation",
        description: "En cours en cuisine",
        empty: "Aucune préparation en cours",
      },
      ready: {
        title: "Prêtes",
        description: "À servir ou à retirer",
        empty: "Aucune commande prête",
      },
    },
    takeaway: "À emporter",
    onSite: "Sur place",
    orderNumber: (displayNumber: string) => `Commande ${displayNumber}`,
    quantity: (quantity: number) => `${quantity} ×`,
    options: (options: string) => `Options : ${options}`,
    note: (note: string) => `Note : ${note}`,
    createdAt: (time: string) => `Reçue à ${time}`,
    actions: {
      accepted: "Accepter",
      preparing: "Lancer la préparation",
      ready: "Marquer comme prête",
      served: "Marquer comme servie",
      picked_up: "Marquer comme retirée",
      pending: "Mise à jour…",
      error: "La commande n’a pas pu être mise à jour. Réessayez.",
      label: (action: string, displayNumber: string) => `${action}, commande ${displayNumber}`,
    },
  },
} as const;
