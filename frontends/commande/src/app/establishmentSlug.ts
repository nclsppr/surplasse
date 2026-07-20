const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type EstablishmentDomainConfig = {
  baseDomain: string;
  reservedSubdomains: string;
};

/** Resolves a direct establishment subdomain against the configured platform domain. */
export function resolveEstablishmentSlug(
  hostname: string,
  config: EstablishmentDomainConfig,
): string {
  const normalizedHostname = normalizeHostname(hostname);
  const baseDomain = normalizeHostname(config.baseDomain);

  if (baseDomain === "" || normalizedHostname === baseDomain) {
    throw new Error("Commande requires a configured establishment subdomain.");
  }

  const suffix = `.${baseDomain}`;
  if (!normalizedHostname.endsWith(suffix)) {
    throw new Error("Commande refuses hosts outside the configured platform domain.");
  }

  const label = normalizedHostname.slice(0, -suffix.length);
  const reserved = new Set(
    config.reservedSubdomains
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  if (label.includes(".") || reserved.has(label) || !validSlug(label)) {
    throw new Error("Commande refuses an invalid or reserved establishment subdomain.");
  }
  return label;
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/u, "");
}

function validSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
