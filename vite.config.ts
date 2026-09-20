import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(rootDir, "web"),
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      "pokemon-tcg-deck-parser": resolve(rootDir, "src/index.ts"),
    },
  },
});
