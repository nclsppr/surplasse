/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import {
  allowedFrontendHosts,
  frontendEnvironmentDefinitions,
  loadFrontendDomainConfig,
} from "../../config/domains/load-domain-config.mjs";

const dashboardRoot = fileURLToPath(new URL(".", import.meta.url));
const brandRoot = fileURLToPath(new URL("../../brand", import.meta.url));

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, dashboardRoot, "VITE_");
  const domains = loadFrontendDomainConfig(mode, environment);

  return {
    plugins: [react(), tailwindcss()],
    define: frontendEnvironmentDefinitions(domains),
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      allowedHosts: allowedFrontendHosts(domains),
      hmr: {
        protocol: "wss",
        clientPort: 443,
      },
      fs: {
        allow: [dashboardRoot, brandRoot],
      },
    },
    test: {
      environment: "node",
    },
  };
});
