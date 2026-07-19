const DEMO_SLUG = "le-cormoran";
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type EstablishmentDomainConfig = {
  baseDomain: string;
  reservedSubdomains: string;
  fallbackSlug?: string;
};

/** Resolves a direct establishment subdomain against the configured platform domain. */
export function resolveEstablishmentSlug(
  hostname: string,
  config: EstablishmentDomainConfig,
): string {
  const fallback = validSlug(config.fallbackSlug) ? config.fallbackSlug : DEMO_SLUG;
  const normalizedHostname = normalizeHostname(hostname);
  const baseDomain = normalizeHostname(config.baseDomain);

  if (baseDomain === "" || normalizedHostname === baseDomain) {
    return fallback;
  }

  const suffix = `.${baseDomain}`;
  if (!normalizedHostname.endsWith(suffix)) {
    return fallback;
  }

  const label = normalizedHostname.slice(0, -suffix.length);
  const reserved = new Set(
    config.reservedSubdomains
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  if (label.includes(".") || reserved.has(label) || !validSlug(label)) {
    return fallback;
  }
  return label;
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/u, "");
}

function validSlug(value: string | undefined): value is string {
  return value !== undefined && SLUG_PATTERN.test(value);
}
