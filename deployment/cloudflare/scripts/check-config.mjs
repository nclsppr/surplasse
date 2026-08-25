import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadDomainConfig } from "../../../config/domains/load-domain-config.mjs";

const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
const wrangler = JSON.parse(readFileSync(configPath, "utf8"));
const domains = loadDomainConfig("production");

for (const candidate of [wrangler.vars, wrangler.env?.production?.vars]) {
  if (candidate?.APP_BASE_DOMAIN !== domains.APP_BASE_DOMAIN) {
    throw new Error("Cloudflare APP_BASE_DOMAIN diverges from production.env");
  }
  if (candidate?.RESERVED_SUBDOMAINS !== domains.RESERVED_SUBDOMAINS) {
    throw new Error("Cloudflare RESERVED_SUBDOMAINS diverges from production.env");
  }
}

if (
  (wrangler.routes?.length ?? 0) !== 0 ||
  (wrangler.env?.production?.routes?.length ?? 0) !== 0
) {
  throw new Error("The product candidate must not carry production routes");
}

if (
  wrangler.workers_dev !== false ||
  wrangler.preview_urls !== false ||
  wrangler.env?.production?.workers_dev !== false ||
  wrangler.env?.production?.preview_urls !== false
) {
  throw new Error("Cloudflare candidates must not expose workers.dev or preview URLs");
}

if (wrangler.observability?.enabled !== false) {
  throw new Error("Workers Logs and Traces must remain disabled while URLs carry tokens");
}

process.stdout.write("Cloudflare configuration matches the production domain profile.\n");
