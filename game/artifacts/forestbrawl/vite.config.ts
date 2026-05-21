import { defineConfig } from "vite";

export default defineConfig({
  base: "/forestbrawl/",
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "23720"),
    allowedHosts: true,
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
});
