const csrfToken = document.querySelector('meta[name="dev-cockpit-csrf"]').content;
const groupsRoot = document.querySelector("#groups");
const notice = document.querySelector("#notice");
const configuration = document.querySelector("#configuration");
const refreshButton = document.querySelector("#refresh");

const groupLabels = {
  applications: ["Applications", "Les processus qui composent le parcours local."],
  tools: ["Outils locaux", "Les aides de développement sans rôle en production."],
  dependencies: ["Dépendances", "Leur cycle de vie appartient à une application."],
  reserved: ["Domaines réservés", "Ces adresses n'ont encore aucun module."],
};

const statusLabels = {
  stopped: "Arrêté",
  starting: "Démarrage",
  ready: "Prêt",
  degraded: "Dégradé",
  failed: "Échec",
  external: "Externe",
  conflict: "Conflit",
  stopping: "Arrêt",
  reserved: "Réservé",
};

const publicUrlLabels = {
  available: "URL disponible",
  redirect: "Redirection 308 prête",
  reserved: "503 attendu",
  "not-configured": "Non configurée",
  misconfigured: "Configuration invalide",
  "certificate-missing": "Certificat absent",
  "certificate-error": "Certificat illisible",
  "certificate-mismatch": "Certificat inattendu",
  "dns-error": "DNS en échec",
  "dns-misdirected": "DNS mal orienté",
  "tls-error": "TLS en échec",
  timeout: "Délai dépassé",
  "proxy-error": "Proxy absent",
  "gateway-error": "Route indisponible",
  "http-error": "HTTP inattendu",
  unavailable: "Indisponible",
};

let actionInProgress = false;
let refreshTimer;

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => runPreset(button.dataset.preset, button.dataset.action));
});
refreshButton.addEventListener("click", refreshState);

await refreshState();
refreshTimer = window.setInterval(refreshState, 2_000);

async function refreshState() {
  try {
    const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error("Le cockpit ne peut pas lire son état.");
    }
    renderState(await response.json());
  } catch (error) {
    showNotice(error.message, true);
  }
}

function renderState(state) {
  groupsRoot.replaceChildren();
  groupsRoot.setAttribute("aria-busy", "false");

  for (const [groupId, [title, description]] of Object.entries(groupLabels)) {
    const modules = state.modules.filter((module) => module.group === groupId);
    if (!modules.length) {
      continue;
    }
    const section = element("section", "module-group");
    const headingRow = element("div", "section-heading");
    const heading = element("h2", null, title);
    const copy = element("p", null, description);
    headingRow.append(heading, copy);
    const grid = element("div", "module-grid");
    modules.forEach((module) => grid.append(renderModule(module)));
    section.append(headingRow, grid);
    groupsRoot.append(section);
  }

  const source = state.urlConfiguration.source;
  const sourceLabel = `Adresses chargées depuis ${source}`;
  configuration.replaceChildren(element("span", null, sourceLabel));
  if (state.urlConfiguration.publicUrl) {
    const control = state.urlConfiguration.publicUrl;
    configuration.append(
      element(
        "span",
        `configuration-route public-state-${control.state}`,
        `Cockpit par domaine : ${publicUrlLabels[control.state] ?? control.state}`,
      ),
    );
  }
  if (state.urlConfiguration.wwwPublicUrl) {
    const www = state.urlConfiguration.wwwPublicUrl;
    const wwwLabel = state.urlConfiguration.wwwUrl ?? "Redirection www";
    configuration.append(
      element(
        "span",
        `configuration-route public-state-${www.state}`,
        `${wwwLabel} : ${publicUrlLabels[www.state] ?? www.state}`,
      ),
    );
  }
  if (state.urlConfiguration.warnings.length) {
    showNotice(state.urlConfiguration.warnings.join(" "), true);
  }
}

function renderModule(module) {
  const card = element("article", `module-card status-${module.status}`);
  const header = element("div", "card-header");
  const titleBlock = element("div");
  titleBlock.append(element("h3", null, module.label), element("p", "description", module.description));
  const badge = element("span", `status-badge status-${module.status}`, statusLabels[module.status] ?? module.status);
  header.append(titleBlock, badge);

  const detail = element("p", "detail", module.detail);
  const publicRoute = module.publicUrl ? renderPublicRoute(module.publicUrl) : null;
  const metadata = element("div", "metadata");
  if (module.ports.length) {
    metadata.append(element("span", "metadata-item", `Ports ${module.ports.join(", ")}`));
  }
  if (module.ownership === "cockpit") {
    metadata.append(element("span", "metadata-item ownership", "Piloté ici"));
  } else if (module.ownership === "external") {
    metadata.append(element("span", "metadata-item ownership-external", "Lancé ailleurs"));
  }

  const links = element("div", "links");
  for (const item of module.links) {
    const anchor = element("a", "link", item.label);
    anchor.href = item.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    links.append(anchor);
  }

  const actions = element("div", "card-actions");
  if (module.canStart) {
    const start = element("button", "button button-small button-primary", "Démarrer");
    start.type = "button";
    start.disabled = actionInProgress;
    start.addEventListener("click", () => runModule(module.id, "start"));
    actions.append(start);
  }
  if (module.canStop) {
    const stop = element("button", "button button-small button-quiet", "Arrêter");
    stop.type = "button";
    stop.disabled = actionInProgress;
    stop.addEventListener("click", () => runModule(module.id, "stop"));
    actions.append(stop);
  }
  if (module.lastError) {
    const error = element("p", "last-error", module.lastError);
    actions.append(error);
  }

  card.append(header, detail);
  if (publicRoute) {
    card.append(publicRoute);
  }
  card.append(metadata, links, actions);
  return card;
}

function renderPublicRoute(publicUrl) {
  const container = element("div", `public-route public-state-${publicUrl.state}`);
  const heading = element("div", "public-route-heading");
  heading.append(
    element("span", "public-route-name", "Accès HTTPS public"),
    element(
      "span",
      "public-route-badge",
      publicUrlLabels[publicUrl.state] ?? publicUrl.state,
    ),
  );
  container.append(heading, element("p", "public-route-detail", publicUrl.detail));
  return container;
}

async function runModule(id, action) {
  await mutate(`/api/modules/${encodeURIComponent(id)}/${action}`, `${action === "start" ? "Démarrage" : "Arrêt"} demandé.`);
}

async function runPreset(name, action) {
  await mutate(`/api/presets/${encodeURIComponent(name)}/${action}`, "Preset exécuté.");
}

async function mutate(path, successMessage) {
  if (actionInProgress) {
    return;
  }
  actionInProgress = true;
  window.clearInterval(refreshTimer);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Surplasse-Cockpit-Token": csrfToken,
      },
      body: "{}",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "L'opération a échoué.");
    }
    showNotice(successMessage, false);
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    actionInProgress = false;
    await refreshState();
    refreshTimer = window.setInterval(refreshState, 2_000);
  }
}

function showNotice(message, isError) {
  notice.hidden = false;
  notice.textContent = message;
  notice.classList.toggle("notice-error", isError);
  window.setTimeout(() => {
    notice.hidden = true;
  }, 5_000);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}
