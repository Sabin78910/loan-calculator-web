/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cspPlugin } from "./src/csp";

// base "./" makes the build work under any GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  plugins: [react(), cspPlugin()],
  test: {
    globals: true,
    css: { include: [/index\.css/] },
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
