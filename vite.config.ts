import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
      // Node built-ins referenced (but never executed) by qpdf-wasm's Emscripten
      // glue — stub them so the browser bundle builds. See node-empty.ts.
      fs: path.resolve(__dirname, "client", "src", "lib", "node-empty.ts"),
      path: path.resolve(__dirname, "client", "src", "lib", "node-empty.ts"),
      crypto: path.resolve(__dirname, "client", "src", "lib", "node-empty.ts"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    target: "es2020",
  },
  optimizeDeps: {
    include: ["tlock-js", "buffer"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
