(function configureStripeConnectPilot() {
  "use strict";

  window.StripeConnect = window.StripeConnect || {};
  const domReady = new Promise((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    } else {
      resolve();
    }
  });

  let initializing = false;

  async function fetchClientSecret() {
    const response = await fetch("/stripe-connect/account-session", {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.client_secret !== "string") {
      throw new Error(payload.error || "stripe_account_session_unavailable");
    }
    return payload.client_secret;
  }

  async function initialize() {
    if (initializing) return;
    initializing = true;
    await domReady;

    const loader = document.getElementById("connect-loader");
    const fallback = document.getElementById("connect-fallback");
    const status = document.getElementById("connect-status");
    const announcement = document.getElementById("connect-announcement");
    const onboardingContainer = document.getElementById("onboarding-container");
    const notificationContainer = document.getElementById("notification-container");

    loader.hidden = false;
    fallback.hidden = true;
    onboardingContainer.replaceChildren();
    notificationContainer.replaceChildren();

    try {
      const configResponse = await fetch("/stripe-connect/config", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const config = await configResponse.json().catch(() => ({}));
      if (!configResponse.ok || typeof config.publishableKey !== "string") {
        const staticPreview = configResponse.status === 404;
        showFallback({
          title: staticPreview ? "Aperçu public uniquement" : "Le pilote n'est pas configuré.",
          message: staticPreview
            ? "Le formulaire Stripe réel est volontairement désactivé sur la démonstration publique. Il fonctionne seulement dans l'environnement local sécurisé du pilote."
            : "Ajoutez les variables Stripe du compte pilote local, puis relancez l'Onboarding.",
          retry: !staticPreview,
          context: staticPreview ? "Démonstration publique" : "Configuration locale requise",
        });
        return;
      }

      document.getElementById("establishment-name").textContent = config.establishmentName;
      const stripeConnectInstance = window.StripeConnect.init({
        publishableKey: config.publishableKey,
        fetchClientSecret,
        locale: "fr-FR",
        appearance: {
          overlays: "dialog",
          variables: {
            colorPrimary: "#b94226",
            colorBackground: "#ffffff",
            colorText: "#181818",
            colorDanger: "#9d3025",
            fontFamily: "Archivo, system-ui, sans-serif",
            borderRadius: "2px",
          },
        },
      });

      const notificationBanner = stripeConnectInstance.create("notification-banner");
      const accountOnboarding = stripeConnectInstance.create("account-onboarding");
      accountOnboarding.setCollectionOptions({
        fields: "eventually_due",
        futureRequirements: "include",
      });
      accountOnboarding.setOnLoaderStart(() => {
        loader.hidden = true;
        status.textContent = "Formulaire sécurisé actif";
        announcement.textContent = "Le formulaire sécurisé d'activation des paiements est prêt.";
      });
      accountOnboarding.setOnStepChange((event) => {
        if (event && typeof event.step === "string") {
          announcement.textContent = `Étape Stripe ouverte : ${event.step}.`;
        }
      });
      accountOnboarding.setOnExit(() => {
        status.textContent = "Progression enregistrée";
        announcement.textContent = "Votre progression a été enregistrée. Vous pourrez reprendre ici.";
      });
      notificationContainer.appendChild(notificationBanner);
      onboardingContainer.appendChild(accountOnboarding);
    } catch {
      showFallback({
        title: "Impossible de charger le formulaire.",
        message: "La connexion sécurisée à Stripe n'a pas abouti. Vérifiez votre réseau puis réessayez.",
        retry: true,
        context: "Connexion au compte pilote interrompue",
      });
    } finally {
      initializing = false;
    }

    function showFallback({ title, message, retry, context }) {
      loader.hidden = true;
      fallback.hidden = false;
      document.getElementById("fallback-title").textContent = title;
      document.getElementById("fallback-message").textContent = message;
      document.getElementById("retry-connect").hidden = !retry;
      document.getElementById("establishment-name").textContent = context;
      status.textContent = "Formulaire indisponible";
      announcement.textContent = title;
      document.getElementById("fallback-title").setAttribute("tabindex", "-1");
      document.getElementById("fallback-title").focus({ preventScroll: true });
    }
  }

  window.StripeConnect.onLoad = initialize;
  domReady.then(() => {
    document.getElementById("retry-connect").addEventListener("click", initialize);
  });
})();
