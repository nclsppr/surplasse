/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import {
  allowedFrontendHosts,
  createPagesDemoDomainConfig,
  frontendEnvironmentDefinitions,
  loadFrontendDomainConfig,
} from "../../config/domains/load-domain-config.mjs";

const dashboardRoot = fileURLToPath(new URL(".", import.meta.url));
const brandRoot = fileURLToPath(new URL("../../brand", import.meta.url));
const designSystemRoot = fileURLToPath(new URL("../design-system2", import.meta.url));
const sharedRoot = fileURLToPath(new URL("../shared", import.meta.url));

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, dashboardRoot, "VITE_");
  const domains = loadFrontendDomainConfig(mode, environment);
  const pagesDemoValue = process.env.VITE_UI2_PAGES_DEMO ?? environment.VITE_UI2_PAGES_DEMO ?? "false";
  if (pagesDemoValue !== "true" && pagesDemoValue !== "false") {
    throw new Error("VITE_UI2_PAGES_DEMO must be true or false.");
  }
  const buildDomains = pagesDemoValue === "true" ? createPagesDemoDomainConfig(domains) : domains;
  const definitions = frontendEnvironmentDefinitions(buildDomains);
  definitions["import.meta.env.VITE_UI2_PAGES_DEMO"] = JSON.stringify(pagesDemoValue);

  return {
    base: "/_experiments/untitled/",
    plugins: [react(), tailwindcss()],
    define: definitions,
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
    server: {
      host: "127.0.0.1",
      port: 5177,
      strictPort: true,
      allowedHosts: [...allowedFrontendHosts(domains)],
      hmr: {
        protocol: "wss",
        clientPort: 443,
      },
      fs: {
        allow: [dashboardRoot, brandRoot, designSystemRoot, sharedRoot],
      },
    },
    test: {
      environment: "node",
    },
  };
});
