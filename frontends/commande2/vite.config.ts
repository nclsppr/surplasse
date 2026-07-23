/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

import {
  allowedFrontendHosts,
  createPagesDemoDomainConfig,
  frontendEnvironmentDefinitions,
  loadFrontendDomainConfig,
} from "../../config/domains/load-domain-config.mjs";

// Port 5176 is reserved for the experimental Commande2 frontend. strictPort
// makes a conflict explicit instead of silently moving the experiment.
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, import.meta.dirname, "VITE_");
  const domains = loadFrontendDomainConfig(mode, environment);
  const pagesDemoValue = process.env.VITE_UI2_PAGES_DEMO ?? environment.VITE_UI2_PAGES_DEMO ?? "false";
  const pagesDemoSlug =
    process.env.VITE_UI2_PAGES_DEMO_SLUG ?? environment.VITE_UI2_PAGES_DEMO_SLUG ?? "";
  if (pagesDemoValue !== "true" && pagesDemoValue !== "false") {
    throw new Error("VITE_UI2_PAGES_DEMO must be true or false.");
  }
  const buildDomains = pagesDemoValue === "true" ? createPagesDemoDomainConfig(domains) : domains;
  const definitions = frontendEnvironmentDefinitions(buildDomains);
  definitions["import.meta.env.VITE_UI2_PAGES_DEMO"] = JSON.stringify(pagesDemoValue);
  definitions["import.meta.env.VITE_UI2_PAGES_DEMO_SLUG"] = JSON.stringify(pagesDemoSlug);

  return {
    base: "/_experiments/untitled/",
    plugins: [react(), tailwindcss()],
    define: definitions,
    resolve: {
      alias: {
        react: resolve(import.meta.dirname, "node_modules/react"),
        "react-dom": resolve(import.meta.dirname, "node_modules/react-dom"),
        "@tanstack/react-query": resolve(
          import.meta.dirname,
          "node_modules/@tanstack/react-query",
        ),
      },
      // shared is a linked source package, so runtime libraries must resolve
      // to one instance regardless of the import origin.
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
    server: {
      host: "127.0.0.1",
      port: 5176,
      strictPort: true,
      allowedHosts: [...allowedFrontendHosts(domains)],
      fs: {
        allow: [
          resolve(import.meta.dirname),
          resolve(import.meta.dirname, "../shared"),
          resolve(import.meta.dirname, "../design-system2"),
          resolve(import.meta.dirname, "../../brand"),
        ],
      },
      hmr: {
        protocol: "wss",
        clientPort: 443,
      },
    },
    test: {
      environment: "node",
      server: {
        deps: {
          inline: true,
        },
      },
    },
  };
});
