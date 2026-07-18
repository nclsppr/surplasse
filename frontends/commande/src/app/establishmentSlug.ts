const PLATFORM_DOMAIN = "surplasse.com";
const RESERVED_SUBDOMAINS = new Set(["www", "dashboard", "api", "docs"]);
const DEMO_SLUG = "le-cormoran";

/**
 * Resolves the establishment slug. In production the slug is the subdomain
 * of the mini-site ({slug}.surplasse.com). Anywhere else (localhost, IP,
 * reserved subdomain), it falls back to VITE_ESTABLISHMENT_SLUG, then to the
 * demo establishment seeded by Flyway.
 */
export function resolveEstablishmentSlug(hostname: string, fallbackSlug: string | undefined): string {
  const fallback = fallbackSlug ?? DEMO_SLUG;
  if (!hostname.endsWith("." + PLATFORM_DOMAIN)) {
    return fallback;
  }
  const label = hostname.slice(0, -(PLATFORM_DOMAIN.length + 1));
  if (label.includes(".") || RESERVED_SUBDOMAINS.has(label)) {
    return fallback;
  }
  return label;
}
