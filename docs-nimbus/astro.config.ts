import { defineConfig } from "astro/config";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";
import nimbus, { defineConfig as defineNimbusConfig } from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to build the Nimbus documentation.`);
  }
  return value;
}

const siteOrigin = requireEnvironment("NIMBUS_SITE_ORIGIN");
const basePath = requireEnvironment("NIMBUS_BASE_PATH").replace(/\/+$/, "");

if (!basePath.startsWith("/")) {
  throw new Error("NIMBUS_BASE_PATH must start with '/'.");
}

const nimbusConfig = defineNimbusConfig({
  site: siteOrigin,
  title: "Surplasse Docs",
  description:
    "Aperçu Nimbus de la documentation produit, technique et opérationnelle de Surplasse.",
  locale: "fr",
  homeLabel: "Accueil",
  github: "https://github.com/nclsppr/surplasse",
  editPattern: null,
  socialImageAlt: "Aperçu de la documentation Surplasse avec Nimbus",
  sidebar: {
    defaultCollapsed: true,
  },
});

export default defineConfig({
  base: `${basePath}/`,
  output: "static",
  // Tailwind v4 via its Vite plugin (the integration Astro recommends for
  // Tailwind v4 — replaces the PostCSS plugin, which doesn't build under
  // Astro 7's Vite 8 bundler).
  vite: {
    plugins: [tailwindcss()],
  },
  // Hover-prefetch link targets so full-page navigations feel instant without
  // a client-side router.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  integrations: [
    icon(),
    nimbus(nimbusConfig, {
      // Authoring rules are opt-in by design — your repo, your taste. The
      // two below are the load-bearing pair: frontmatter has to validate
      // against the content schema for the page to render properly, and
      // broken internal links are 404s for your readers. Add the others
      // (heading hierarchy, code-block language, style, etc.) when you're
      // ready to enforce them — see `nimbus-docs lint --help`.
      rules: {
        "nimbus/frontmatter-shape": "error",
        "nimbus/internal-link": "error",
      },
      // Wrap wide tables so they scroll instead of overflowing the page
      // (styled by `.nb-table-scroll` in src/styles/prose.css).
      markdown: {
        hastPlugins: [tableScroll()],
      },
    }),
  ],
});
