/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import {
  allowedFrontendHosts,
  frontendEnvironmentDefinitions,
  loadFrontendDomainConfig,
} from "../../config/domains/load-domain-config.mjs";

// Port 5173: conventional port of the Commande frontend
// (docs/developpement/index.md). strictPort: a busy port must fail loudly,
// never drift to a neighbor.
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, import.meta.dirname, "VITE_");
  const domains = loadFrontendDomainConfig(mode, environment);

  return {
    plugins: [react(), tailwindcss()],
    define: frontendEnvironmentDefinitions(domains),
    resolve: {
      // shared is a linked source package, so runtime libraries must resolve
      // to one instance regardless of the import origin.
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      allowedHosts: allowedFrontendHosts(domains),
      hmr: {
        protocol: "wss",
        clientPort: 443,
      },
    },
    test: {
      environment: "node",
    },
  };
});
