/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Port 5173: conventional port of the Commande frontend
// (docs/developpement/index.md). strictPort: a busy port must fail loudly,
// never drift to a neighbor.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // shared est un paquet lié consommé en source : une seule instance de
    // React et de Query, quelle que soit la provenance de l'import.
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "node",
  },
});
