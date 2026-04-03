import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/3d-music-scales/",
  build: {
    outDir: "docs",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
