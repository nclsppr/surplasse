const csrfToken = document.querySelector('meta[name="dev-cockpit-csrf"]').content;
const groupsRoot = document.querySelector("#groups");
const notice = document.querySelector("#notice");
const configuration = document.querySelector("#configuration");
const refreshButton = document.querySelector("#refresh");
const modulesView = document.querySelector("#modules-view");
const testsView = document.querySelector("#tests-view");
const qualitySuitesRoot = document.querySelector("#quality-suites");
const runAllTestsButton = document.querySelector("#run-all-tests");
const allureReport = document.querySelector("#allure-report");
const allureReportCopy = document.querySelector("#allure-report-copy");
const allureReportResult = document.querySelector("#allure-report-result");
const isTestsView = window.location.pathname === "/tests";

const groupLabels = {
  infrastructure: ["Infrastructure", "L’entrée HTTPS du cluster, visible ici en lecture seule."],
  applications: ["Applications", "Les modules du parcours local dans Docker Compose."],
  tools: ["Outils locaux", "Les aides de développement exécutées dans le cluster."],
  dependencies: ["Dépendances", "Les services persistants gérés par Docker Compose."],
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
  unavailable: "Indisponible",
};

const qualityLabels = {
  "not-run": "Non exécuté",
  queued: "En attente",
  running: "En cours",
  passed: "Validé",
  failed: "Échec",
  interrupted: "Interrompu",
};

const reportLabels = {
  "not-run": "Non publié",
  passed: "Validé",
  failed: "Échec",
  broken: "Incomplet",
  skipped: "Ignoré",
  unknown: "État inconnu",
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
let lastRenderedStateSignature = null;
let refreshTimer;
let noticeTimer;

document.title = isTestsView ? "Tests et rapports · Surplasse" : "Cockpit local · Surplasse";
modulesView.hidden = isTestsView;
testsView.hidden = !isTestsView;
document.querySelector(`[data-nav="${isTestsView ? "tests" : "modules"}"]`).setAttribute("aria-current", "page");

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => runPreset(button.dataset.preset, button.dataset.action));
});
runAllTestsButton.addEventListener("click", () => runQuality("/api/quality/run", "Toutes les vérifications sont lancées."));
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
    renderLoadError();
    showNotice(error.message, true);
  }
}

function renderState(state) {
  const { updatedAt: _updatedAt, ...stableState } = state;
  const signature = JSON.stringify(stableState);
  if (signature === lastRenderedStateSignature) {
    return;
  }
  lastRenderedStateSignature = signature;
  const controlsBusy = actionInProgress || Boolean(state.compose?.running) || Boolean(state.quality?.running);
  if (!isTestsView) {
    renderModules(state, controlsBusy);
  }
  renderQuality(state.quality, controlsBusy);
  renderAllureReport(state.reports?.allureDevelopment, state.quality);
}

function renderModules(state, controlsBusy) {
  groupsRoot.replaceChildren();
  groupsRoot.setAttribute("aria-busy", "false");

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.disabled = controlsBusy || !state.compose?.available;
  });

  for (const [groupId, [title, description]] of Object.entries(groupLabels)) {
    const modules = state.modules.filter((module) => module.group === groupId);
    if (!modules.length) {
      continue;
    }
    const section = element("section", "module-group");
    const headingRow = element("div", "section-heading");
    headingRow.append(element("h2", null, title), element("p", null, description));
    const grid = element("div", "module-grid");
    modules.forEach((module) => grid.append(renderModule(module, controlsBusy)));
    section.append(headingRow, grid);
    groupsRoot.append(section);
  }

  configuration.replaceChildren(element("span", null, `Adresses chargées depuis ${state.urlConfiguration.source}`));
  configuration.append(element(
    "span",
    `configuration-route ${state.compose?.available ? "public-state-available" : "public-state-unavailable"}`,
    state.compose?.running
      ? "Docker Compose : opération en cours"
      : state.compose?.available
        ? "Docker Compose : connecté"
        : "Docker Compose : indisponible",
  ));
  if (state.urlConfiguration.publicUrl) {
    const control = state.urlConfiguration.publicUrl;
    configuration.append(element("span", `configuration-route public-state-${control.state}`, `Cockpit HTTPS : ${publicUrlLabels[control.state] ?? control.state}`));
  }
  if (state.compose?.error) {
    configuration.append(element("span", "configuration-error", state.compose.error));
  }
  if (state.urlConfiguration.warnings.length) {
    showNotice(state.urlConfiguration.warnings.join(" "), true);
  }
}

function renderQuality(quality, controlsBusy) {
  if (!quality) {
    return;
  }
  const shortcutDot = document.querySelector("#quality-shortcut-dot");
  const shortcutLabel = document.querySelector("#quality-shortcut-label");
  shortcutDot.className = `state-dot state-${quality.status}`;
  shortcutLabel.textContent = overallLabel(quality);

  if (!isTestsView) {
    return;
  }

  const summary = document.querySelector("#quality-summary");
  const summaryDot = document.querySelector("#quality-summary-dot");
  summary.setAttribute("aria-busy", quality.running ? "true" : "false");
  summary.className = `quality-summary quality-${quality.status}`;
  summaryDot.className = `state-dot state-${quality.status}`;
  document.querySelector("#quality-summary-title").textContent = overallLabel(quality);
  document.querySelector("#quality-summary-copy").textContent = summaryCopy(quality);
  runAllTestsButton.disabled = controlsBusy;
  runAllTestsButton.textContent = quality.running ? "Vérification en cours..." : "Tout relancer";

  qualitySuitesRoot.replaceChildren();
  quality.suites.forEach((suite) => qualitySuitesRoot.append(renderQualitySuite(suite, controlsBusy)));
}

function renderQualitySuite(suite, anyRunning) {
  const row = element("article", `quality-suite quality-${suite.status}`);
  const identity = element("div", "quality-identity");
  const title = element("div", "quality-title");
  title.append(element("span", `state-dot state-${suite.status}`), element("h2", null, suite.label));
  identity.append(title, element("p", "description", suite.description), element("p", "suite-hint", suite.hint));

  const result = element("div", "quality-result");
  result.append(element("span", `quality-badge quality-${suite.status}`, qualityLabels[suite.status] ?? suite.status));
  const facts = element("p", "quality-facts", suiteFacts(suite));
  result.append(facts);

  const actions = element("div", "quality-actions");
  const rerun = element("button", "button button-small button-secondary", suite.status === "not-run" ? "Exécuter" : "Relancer");
  rerun.type = "button";
  rerun.disabled = anyRunning || actionInProgress;
  rerun.addEventListener("click", () => runQuality(`/api/quality/${encodeURIComponent(suite.id)}/run`, `${suite.label} est lancé.`));
  actions.append(rerun);
  if (suite.output) {
    const details = element("details", "quality-output");
    details.append(element("summary", null, suite.status === "failed" ? "Voir l’erreur" : "Voir la sortie"), element("pre", null, suite.output));
    actions.append(details);
  }
  row.append(identity, result, actions);
  return row;
}

function renderModule(module, controlsBusy) {
  const card = element("article", `module-card status-${module.status}`);
  const header = element("div", "card-header");
  const titleBlock = element("div");
  titleBlock.append(element("h3", null, module.label), element("p", "description", module.description));
  header.append(titleBlock, element("span", `status-badge status-${module.status}`, statusLabels[module.status] ?? module.status));

  const metadata = element("div", "metadata");
  if (module.ports.length) {
    metadata.append(element("span", "metadata-item", `Ports internes ${module.ports.join(", ")}`));
  }
  if (module.ownership === "compose") {
    metadata.append(element("span", "metadata-item ownership", "Docker Compose"));
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
    actions.append(moduleButton(module.id, "start", "Démarrer", "button-primary", controlsBusy));
  }
  if (module.canStop) {
    actions.append(moduleButton(module.id, "stop", "Arrêter", "button-quiet", controlsBusy));
  }
  if (module.lastError) {
    actions.append(element("p", "last-error", module.lastError));
  }

  card.append(header, element("p", "detail", module.detail));
  if (module.publicUrl) {
    card.append(renderPublicRoute(module.publicUrl));
  }
  card.append(metadata, links, actions);
  return card;
}

function moduleButton(id, action, label, variant, controlsBusy) {
  const button = element("button", `button button-small ${variant}`, label);
  button.type = "button";
  button.disabled = controlsBusy;
  button.addEventListener("click", () => runModule(id, action));
  return button;
}

function renderAllureReport(report, quality) {
  if (!isTestsView) {
    return;
  }
  const e2eSuite = quality?.suites?.find((suite) => suite.id === "e2e-development");
  const generating = ["queued", "running"].includes(e2eSuite?.status);
  const status = report?.available ? report.status : "not-run";
  allureReport.className = `report-card report-${status}`;
  allureReport.setAttribute("aria-busy", generating ? "true" : "false");
  allureReportResult.replaceChildren();

  if (!report?.available) {
    allureReportCopy.textContent = generating
      ? "Le premier rapport est en cours de génération. Il sera publié à la fin du parcours."
      : "Aucun rapport development n’a encore été publié. Lancez la suite Parcours Playwright.";
    allureReportResult.append(element("span", `quality-badge quality-${status}`, reportLabels[status]));
    return;
  }

  const total = Number.isInteger(report.total) ? report.total : 0;
  const passed = Number.isInteger(report.passed) ? report.passed : 0;
  const skipped = Number.isInteger(report.skipped) ? report.skipped : 0;
  const freshness = report.createdAt ? ` Publié ${formatDate(report.createdAt)}.` : "";
  const progress = total > 0
    ? skipped > 0
      ? `${passed} réussi${passed > 1 ? "s" : ""}, ${skipped} ignoré${skipped > 1 ? "s" : ""} sur ${total} scénario${total > 1 ? "s" : ""}.`
      : `${passed}/${total} scénarios validés.`
    : "Résultats détaillés disponibles.";
  allureReportCopy.textContent = generating
    ? `${progress}${freshness} Un nouveau parcours s’exécute, ce rapport reste consultable jusqu’à sa publication.`
    : `${progress}${freshness}`;

  const facts = element("div", "report-facts");
  facts.append(element("span", `quality-badge quality-${status}`, reportLabels[status] ?? status));
  if (Number.isFinite(report.durationMs)) {
    facts.append(element("span", "quality-facts", formatDuration(report.durationMs)));
  }
  allureReportResult.append(facts);

  const reportUrl = safeReportUrl(report.url);
  if (reportUrl) {
    const link = element("a", "button button-secondary report-link", "Ouvrir le dernier rapport");
    link.href = reportUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    allureReportResult.append(link);
  } else {
    allureReportResult.append(element("p", "last-error", "L’adresse du rapport est invalide."));
  }
}

function safeReportUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function renderPublicRoute(publicUrl) {
  const container = element("div", `public-route public-state-${publicUrl.state}`);
  const heading = element("div", "public-route-heading");
  heading.append(element("span", "public-route-name", "Accès HTTPS"), element("span", "public-route-badge", publicUrlLabels[publicUrl.state] ?? publicUrl.state));
  container.append(heading, element("p", "public-route-detail", publicUrl.detail));
  return container;
}

function overallLabel(quality) {
  if (quality.status === "running") {
    return "Vérification en cours";
  }
  if (quality.status === "passed") {
    return "Plateforme validée";
  }
  if (quality.status === "failed") {
    const failures = quality.suites.filter((suite) => ["failed", "interrupted"].includes(suite.status)).length;
    return `${failures} ${failures > 1 ? "suites à corriger" : "suite à corriger"}`;
  }
  const pending = quality.suites.filter((suite) => suite.status === "not-run").length;
  if (pending > 0 && pending < quality.suites.length) {
    return `${pending} ${pending > 1 ? "suites à exécuter" : "suite à exécuter"}`;
  }
  return "Tests non exécutés";
}

function summaryCopy(quality) {
  const passed = quality.suites.filter((suite) => suite.status === "passed").length;
  const update = quality.updatedAt ? ` Dernière activité ${formatDate(quality.updatedAt)}.` : "";
  if (quality.running) {
    const active = quality.suites.find((suite) => suite.status === "running");
    return `${active?.label ?? "Une suite"} s’exécute. ${passed} sur ${quality.suites.length} sont déjà validées.${update}`;
  }
  if (quality.status === "passed") {
    return `Les ${quality.suites.length} suites sont au vert.${update}`;
  }
  if (quality.status === "failed") {
    return `${passed} sur ${quality.suites.length} suites sont validées. Ouvrez le détail de la suite en échec.${update}`;
  }
  if (passed > 0) {
    const pending = quality.suites.length - passed;
    return `${passed} sur ${quality.suites.length} suites sont validées. ${pending} ${pending > 1 ? "restent à exécuter" : "reste à exécuter"}.${update}`;
  }
  return "Lancez toutes les suites pour établir un premier état de référence.";
}

function suiteFacts(suite) {
  if (suite.status === "running") {
    return `Étape en cours · démarrée ${formatDate(suite.startedAt)}`;
  }
  if (suite.status === "queued") {
    return "Démarrera après la suite en cours";
  }
  if (!suite.completedAt) {
    return `${suite.stepCount} ${suite.stepCount > 1 ? "étapes" : "étape"}`;
  }
  const duration = formatDuration(suite.durationMs);
  const failure = suite.failedStep ? ` · arrêt sur « ${suite.failedStep} »` : "";
  return `${suite.completedSteps}/${suite.stepCount} étapes · ${duration} · ${formatDate(suite.completedAt)}${failure}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "durée inconnue";
  }
  if (milliseconds < 1_000) {
    return `${milliseconds} ms`;
  }
  const seconds = Math.round(milliseconds / 1_000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

async function runModule(id, action) {
  await mutate(`/api/modules/${encodeURIComponent(id)}/${action}`, `${action === "start" ? "Démarrage" : "Arrêt"} lancé dans Docker Compose.`);
}

async function runPreset(name, action) {
  await mutate(`/api/presets/${encodeURIComponent(name)}/${action}`, "Opération Docker Compose lancée.");
}

async function runQuality(path, successMessage) {
  await mutate(path, successMessage);
}

async function mutate(path, successMessage) {
  if (actionInProgress) {
    return;
  }
  actionInProgress = true;
  setInteractiveBusy(true);
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
    lastRenderedStateSignature = null;
    await refreshState();
  }
}

function setInteractiveBusy(busy) {
  document
    .querySelectorAll("button[data-preset], .module-card button, #run-all-tests, .quality-suite button")
    .forEach((button) => {
      button.disabled = busy;
    });
}

function renderLoadError() {
  if (!isTestsView && groupsRoot.childElementCount === 0) {
    groupsRoot.setAttribute("aria-busy", "false");
    groupsRoot.append(element("p", "empty-state", "L’état Docker Compose ne peut pas être chargé pour le moment."));
  }
  if (isTestsView && qualitySuitesRoot.childElementCount === 0) {
    document.querySelector("#quality-summary").setAttribute("aria-busy", "false");
    document.querySelector("#quality-summary-title").textContent = "Résultats indisponibles";
    document.querySelector("#quality-summary-copy").textContent = "Réessayez après avoir vérifié le terminal du cockpit.";
    allureReport.setAttribute("aria-busy", "false");
    allureReportCopy.textContent = "Le dernier rapport ne peut pas être lu pour le moment.";
  }
}

function showNotice(message, isError) {
  notice.hidden = false;
  notice.textContent = message;
  notice.classList.toggle("notice-error", isError);
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.hidden = true;
  }, 5_000);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined && text !== null) {
    node.textContent = text;
  }
  return node;
}
