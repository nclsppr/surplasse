/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dashboardRoot = fileURLToPath(new URL(".", import.meta.url));
const brandRoot = fileURLToPath(new URL("../../brand", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [dashboardRoot, brandRoot],
    },
  },
  test: {
    environment: "node",
  },
});
