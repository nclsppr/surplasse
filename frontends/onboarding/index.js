const orderStates = Object.freeze([
  { id: "paid", label: "Nouvelle commande", action: "Accepter la commande" },
  { id: "accepted", label: "Commande acceptée", action: "Lancer la préparation" },
  { id: "preparing", label: "En préparation", action: "Marquer comme prête" },
  { id: "ready", label: "Commande prête", action: "Marquer comme servie" },
  { id: "served", label: "Commande servie", action: "Rejouer la simulation" },
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
  const currentStatus = consoleElement?.querySelector("[data-current-status]");
  const statusElements = [...(consoleElement?.querySelectorAll("[data-status]") ?? [])];
  if (!consoleElement || !advanceButton || !currentStatus || statusElements.length === 0) return;

  let stateIndex = 0;

  const render = () => {
    const state = orderStates[stateIndex];
    consoleElement.dataset.state = state.id;
    currentStatus.textContent = state.label;
    advanceButton.textContent = state.action;
    statusElements.forEach((element, index) => {
      element.classList.toggle("is-complete", index < stateIndex);
      element.classList.toggle("is-current", index === stateIndex);
      element.setAttribute("aria-current", index === stateIndex ? "step" : "false");
    });
  };

  advanceButton.addEventListener("click", () => {
    stateIndex = stateIndex === orderStates.length - 1 ? 0 : stateIndex + 1;
    render();
  });

  render();
}

configureDomainLinks();
initializeOrderConsole();
