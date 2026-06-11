import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      // opentimestamps declares main: "open-timestamps.js" which doesn't exist;
      // Node falls back to index.js, Vite errors out. Point Vite at the real entry.
      opentimestamps: path.resolve(__dirname, "node_modules", "opentimestamps", "index.js"),
    },
  },
});
