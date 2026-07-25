const orderStates = Object.freeze([
  {
    id: "paid",
    label: "Nouvelle commande",
    action: "Accepter la commande",
    announcement: "Commande 1042 reçue depuis le QR de la table 12.",
  },
  {
    id: "accepted",
    label: "Commande acceptée",
    action: "Lancer la préparation",
    announcement: "Commande 1042 acceptée par l’équipe.",
  },
  {
    id: "preparing",
    label: "En préparation",
    action: "Marquer comme prête",
    announcement: "Préparation de la commande 1042 lancée.",
  },
  {
    id: "ready",
    label: "Commande prête",
    action: "Marquer comme servie",
    announcement: "Commande 1042 prête à servir.",
  },
  {
    id: "served",
    label: "Commande servie",
    action: "Rejouer depuis le QR",
    announcement: "Commande 1042 servie à la table 12.",
  },
]);

function configureDomainLinks() {
  const domainConfig = window.SURPLASSE_DOMAIN_CONFIG;
  const notice = document.querySelector("[data-config-notice]");
  if (!domainConfig?.DASHBOARD_URL || !domainConfig?.DOCS_URL) {
    if (notice) notice.hidden = false;
    return;
  }

  const dashboardLogin = document.getElementById("dashboard-login-url");
  const footerDashboard = document.getElementById("footer-dashboard-url");
  const footerDocs = document.getElementById("footer-docs-url");
  const dashboardUrl = `${domainConfig.DASHBOARD_URL}/auth/login`;

  if (dashboardLogin) {
    dashboardLogin.href = dashboardUrl;
    dashboardLogin.hidden = false;
  }
  if (footerDashboard) footerDashboard.href = dashboardUrl;
  if (footerDocs) footerDocs.href = domainConfig.DOCS_URL;

  for (const link of document.querySelectorAll("[data-doc-path]")) {
    link.href = `${domainConfig.DOCS_URL}${link.dataset.docPath}`;
  }
}

function initializeOrderConsole() {
  const consoleElement = document.querySelector("[data-order-console]");
  const advanceButton = consoleElement?.querySelector("[data-advance-order]");
  const resetButton = consoleElement?.querySelector("[data-reset-order]");
  const currentStatus = consoleElement?.querySelector("[data-current-status]");
  const announcement = consoleElement?.querySelector("[data-order-announcement]");
  const statusRail = consoleElement?.querySelector(".status-rail");
  const statusElements = [...(consoleElement?.querySelectorAll("[data-status]") ?? [])];
  const triggerButtons = [...document.querySelectorAll("[data-trigger-order]")];
  if (
    !consoleElement ||
    !advanceButton ||
    !resetButton ||
    !currentStatus ||
    !announcement ||
    statusElements.length !== orderStates.length
  ) {
    return;
  }

  let stateIndex = 0;

  const render = (message = orderStates[stateIndex].announcement) => {
    const state = orderStates[stateIndex];
    consoleElement.dataset.state = state.id;
    currentStatus.textContent = state.label;
    advanceButton.textContent = state.action;
    resetButton.disabled = stateIndex === 0;
    announcement.textContent = message;
    statusElements.forEach((element, index) => {
      element.classList.toggle("is-complete", index < stateIndex);
      element.classList.toggle("is-current", index === stateIndex);
      element.setAttribute("aria-current", index === stateIndex ? "step" : "false");
    });
    const activeStatus = statusElements[stateIndex];
    if (statusRail && activeStatus && statusRail.scrollWidth > statusRail.clientWidth) {
      const centeredLeft =
        activeStatus.offsetLeft - (statusRail.clientWidth - activeStatus.clientWidth) / 2;
      statusRail.scrollTo({
        left: Math.max(0, centeredLeft),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  };

  const replayArrival = ({ moveFocus = false } = {}) => {
    stateIndex = 0;
    render("Commande 1042 reçue depuis le QR de la table 12.");
    consoleElement.classList.remove("is-arriving");
    void consoleElement.offsetWidth;
    consoleElement.classList.add("is-arriving");
    consoleElement.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    if (moveFocus) consoleElement.focus({ preventScroll: true });
  };

  advanceButton.addEventListener("click", () => {
    if (stateIndex === orderStates.length - 1) {
      replayArrival();
      return;
    }
    stateIndex += 1;
    render();
  });

  resetButton.addEventListener("click", () => {
    stateIndex = 0;
    render("Commande 1042 replacée dans les nouvelles commandes.");
    advanceButton.focus({ preventScroll: true });
  });

  triggerButtons.forEach((button) => {
    button.addEventListener("click", () => replayArrival({ moveFocus: true }));
  });

  consoleElement.addEventListener("animationend", () => {
    consoleElement.classList.remove("is-arriving");
  });

  render("Commande reçue à 19:12.");
}

function initializeMobileNavigation() {
  const mobileNavigation = document.querySelector(".mobile-nav");
  if (!mobileNavigation) return;

  mobileNavigation.querySelectorAll("a[href^='#']").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      mobileNavigation.removeAttribute("open");
      window.history.pushState(null, "", link.hash);
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  });

  mobileNavigation.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    mobileNavigation.removeAttribute("open");
    mobileNavigation.querySelector("summary")?.focus();
  });

  const desktopQuery = window.matchMedia("(min-width: 1060px)");
  desktopQuery.addEventListener("change", (event) => {
    if (event.matches) mobileNavigation.removeAttribute("open");
  });
}

configureDomainLinks();
initializeOrderConsole();
initializeMobileNavigation();
