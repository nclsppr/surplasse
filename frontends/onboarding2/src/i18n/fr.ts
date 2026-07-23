/**
 * Interface strings are externalized from the first component, following the
 * React conventions. French is currently the experiment's default and only
 * language.
 */
export const fr = {
  runtime: {
    rootMissing: "Root element #root is missing from index.html",
  },
  common: {
    skipToContent: "Aller au contenu",
    brand: {
      tagline: "Le circuit court de la commande",
      experimentalHomeLabel: "Surplasse, accueil expérimental",
      experimentalReturnLabel: "Surplasse, retour à l'accueil expérimental",
    },
  },
  header: {
    navigationLabel: "Navigation principale",
    openNavigationLabel: "Ouvrir la navigation",
    closeNavigationLabel: "Fermer la navigation",
    links: {
      howItWorks: "Fonctionnement",
      liveService: "Service live",
      pricing: "Tarif",
    },
    login: "Se connecter",
    demo: "Tester la démo",
  },
  pagesDemo: {
    badge: "Preuve GitHub Pages",
    title: "Démonstration statique, sans Backend.",
    description:
      "Les liens restent dans cette publication publique. Aucune session, carte envoyée ni donnée restaurateur n'est transmise.",
  },
  serviceDemo: {
    states: {
      paid: {
        short: "Payée",
        label: "Nouvelle commande",
        action: "Accepter la commande",
      },
      accepted: {
        short: "Acceptée",
        label: "Commande acceptée",
        action: "Lancer la préparation",
      },
      preparing: {
        short: "En préparation",
        label: "En préparation",
        action: "Marquer comme prête",
      },
      ready: {
        short: "Prête",
        label: "Prête à servir",
        action: "Marquer comme servie",
      },
      served: {
        short: "Servie",
        label: "Commande servie",
        action: "Rejouer l'aperçu",
      },
    },
    orderNumber: "Commande #1042",
    table: "Table 12",
    paymentConfirmed: "Paiement confirmé",
    orderContentsLabel: "Contenu de la commande de démonstration",
    lines: [
      { quantity: "2 ×", product: "Margherita", price: "24,00 €" },
      { quantity: "1 ×", product: "Burrata", price: "13,00 €" },
    ],
    totalPaid: "Total payé",
    total: "37,00 €",
    progressLabel: "Progression de la commande",
    currentStatus: "Statut actuel",
  },
  footer: {
    description: "Le circuit court de la commande, pensé pour les restaurants indépendants.",
    demo: "Tester la démo",
    navigationLabel: "Pied de page",
    groups: {
      product: {
        title: "Produit",
        howItWorks: "Fonctionnement",
        liveService: "Service live",
        pricing: "Tarification",
      },
      resources: {
        title: "Ressources",
        productVision: "Vision produit",
        roadmap: "Roadmap",
        documentation: "Documentation",
      },
      access: {
        title: "Accès",
        demo: "Démonstration",
        restaurantSpace: "Espace restaurant",
        faq: "Questions fréquentes",
      },
    },
    copyright: "Surplasse © 2026",
    directChannel: "Canal direct",
  },
  landing: {
    hero: {
      experiment: "Exploration Untitled UI",
      kicker: "Le circuit court de la commande",
      title: "Vos commandes. Vos clients. Votre restaurant.",
      intro:
        "Un canal de commande directe aux couleurs de votre établissement. Le client scanne, choisit et paie sans compte. Vous gardez vos prix, vos clients et votre relation.",
      demo: "Tester la démo",
      seeCustomerJourney: "Voir le parcours client",
      visualLabel: "Le passe d'une cuisine prêt pour le service",
      visualBadge: "Le passe ouvert",
      visualCaption: "De la table à la cuisine, sans détour.",
      routeLabel: "Parcours direct de la commande",
      route: {
        scan: "Scanner",
        choose: "Choisir",
        pay: "Payer",
        serve: "Servir",
      },
    },
    process: {
      kicker: "Le circuit, sans détour",
      title: "Votre carte devient un service complet.",
      intro:
        "Une photo suffit pour structurer votre carte. Le QR l'ouvre à la bonne table, le client paie depuis son téléphone et la commande arrive directement en cuisine.",
      steps: {
        card: {
          label: "Carte",
          title: "Partir de votre carte",
          description:
            "Photographiez ce que vous utilisez déjà. Aucun fichier à reformater avant de commencer.",
          status: "Point de départ",
        },
        structure: {
          label: "Structure",
          title: "Relire la structure",
          description:
            "Surplasse propose les catégories, les plats, les prix et les éléments à vérifier. Vous gardez le dernier mot.",
          status: "Validé par vous",
        },
        table: {
          label: "Table",
          title: "Ouvrir la table",
          description:
            "Un QR mène directement à la carte de l'établissement, sans application et sans compte client.",
          status: "Accès direct",
        },
        kitchen: {
          label: "Cuisine",
          title: "Servir la commande",
          description:
            "Table, options et paiement arrivent ensemble. L'équipe accepte, prépare, sert et garde le rythme.",
          status: "Équipe synchronisée",
        },
      },
    },
    live: {
      badge: "Aperçu interactif",
      kicker: "Service live",
      title: "Faites avancer la commande #1042.",
      description:
        "Essayez le geste central du Dashboard, du paiement confirmé à la commande servie. Les plats, le prix et la table ci-contre sont des données de démonstration.",
    },
    direct: {
      kicker: "Votre canal, pas notre marketplace",
      title: "Une relation directe vaut mieux qu'une place dans une liste.",
      intro:
        "Surplasse est l'infrastructure discrète de votre restaurant. Votre enseigne reste au premier plan.",
      points: [
        {
          label: "Relation",
          title: "Vos clients restent vos clients.",
          description:
            "Pas de répertoire de restaurants concurrents, pas de course au classement, pas de marque intermédiaire au moment de commander.",
        },
        {
          label: "Prix",
          title: "0 % pendant 3 mois, puis 1 % par commande.",
          description: "Les frais Stripe sont distincts et s'appliquent dès le premier paiement.",
        },
        {
          label: "Identité",
          title: "Votre restaurant reste visible.",
          description:
            "La carte client porte le nom, les couleurs et le ton de votre établissement, pas ceux d'une marketplace.",
        },
      ],
    },
    customer: {
      visualCaption: "La table reste le point de départ.",
      kicker: "Côté client",
      title: "Pas d'application. Pas de compte. Pas d'attente inutile.",
      description:
        "La carte s'ouvre immédiatement. Le client commande à son rythme et règle depuis son téléphone, selon son appareil et la configuration du paiement.",
      benefits: [
        { title: "La bonne table", description: "Le contexte de commande est déjà là." },
        { title: "Le bon rythme", description: "Le client choisit sans interrompre l'équipe." },
        { title: "La bonne information", description: "Les options voyagent avec la commande." },
      ],
    },
    faq: {
      kicker: "Questions franches",
      title: "Les réponses avant le premier clic.",
      items: [
        {
          question: "Comment démarrer avec Surplasse ?",
          answer:
            "Photographiez votre carte, relisez la structure proposée puis publiez-la. Vous pouvez ensuite installer les QR aux tables et ouvrir la prise de commandes.",
        },
        {
          question: "Le client doit-il installer une application ?",
          answer:
            "Non. Le QR ouvre directement la carte de votre établissement dans le navigateur du téléphone, sans compte client.",
        },
        {
          question: "Quel est le coût ?",
          answer:
            "0 % de commission pendant les 3 premiers mois, puis 1 % par commande. Les frais Stripe restent distincts.",
        },
        {
          question: "Qui garde la relation client ?",
          answer:
            "Le restaurant. Surplasse n'est pas une marketplace. Votre établissement n'est jamais placé dans une liste de concurrents.",
        },
      ],
    },
    final: {
      kicker: "Le prochain service commence ici",
      title: "Trois minutes pour voir si le circuit vous ressemble.",
      action: "Tester avec ma carte",
      description: "Une démonstration guidée à partir de votre carte.",
    },
  },
  create: {
    returnHome: "Retour à l'accueil",
    badge: "Étape expérimentale",
    kicker: "Tester le parcours",
    title: "Votre carte est le point de départ.",
    intro:
      "Onboarding2 explore le nouveau langage visuel. Le traitement complet d'une carte reste, pour l'instant, dans le tunnel de démonstration original.",
    steps: {
      photo: {
        label: "Photo",
        title: "Photographier votre carte",
        description: "Vous partez du document que votre équipe utilise déjà.",
      },
      review: {
        label: "Relecture",
        title: "Vérifier la structure proposée",
        description: "Catégories, plats et prix restent sous votre contrôle.",
      },
      publish: {
        label: "Publication",
        title: "Préparer votre canal direct",
        description: "La carte relue peut ensuite rejoindre les QR et le Dashboard.",
      },
    },
    handoff: {
      title: "Ce qui va se passer",
      description:
        "Le bouton ouvre le tunnel actuel sur le domaine Onboarding du profil actif. Vous quittez l'expérience Untitled UI, sans changer de compte ni de Backend.",
      pagesDescription:
        "Le bouton ouvre le tunnel original dans cette même publication GitHub Pages. Aucun compte, fichier ni appel Backend n'est transmis.",
    },
    openOriginal: "Ouvrir le tunnel original",
    returnToExploration: "Revenir à l'exploration",
    visual: {
      badge: "Le passe ouvert",
      caption: "Une interface alternative. Le même parcours métier.",
    },
  },
  notFound: {
    kicker: "Page introuvable",
    title: "Ce passage n'existe pas.",
    description: "Revenez à l'accueil de l'expérience Onboarding2.",
    action: "Retour à l'accueil",
  },
} as const;
