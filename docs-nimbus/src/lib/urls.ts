const basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

export function withBase(pathname = "/"): string {
  const pathWithLeadingSlash = pathname.startsWith("/")
    ? pathname
    : `/${pathname}`;

  if (!basePath) return pathWithLeadingSlash;
  if (
    pathWithLeadingSlash === basePath ||
    pathWithLeadingSlash.startsWith(`${basePath}/`)
  ) {
    return pathWithLeadingSlash;
  }
  if (pathWithLeadingSlash === "/") return `${basePath}/`;
  return `${basePath}${pathWithLeadingSlash}`;
}

export function withoutBase(pathname: string): string {
  if (!basePath) return pathname || "/";
  if (pathname === basePath || pathname === `${basePath}/`) return "/";
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || "/";
  }
  return pathname || "/";
}

function prefixHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  return withBase(href);
}

export function prefixNavigationHrefs<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => prefixNavigationHrefs(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    const output = {} as Record<string, unknown>;
    for (const [key, child] of Object.entries(value)) {
      output[key] =
        (key === "href" || key === "indexHref") &&
        typeof child === "string"
          ? prefixHref(child)
          : prefixNavigationHrefs(child);
    }
    return output as T;
  }

  return value;
}

export function absoluteSiteUrl(pathname: string, site: URL | string): string {
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(pathname)) {
    return new URL(pathname.startsWith("//") ? `https:${pathname}` : pathname)
      .href;
  }
  return new URL(withBase(pathname), site).href;
}
