import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const entry = resolve(__dirname, "src/index.ts");

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  target: ["node24"],
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  outdir: "dist",
  sourcemap: true,
  logLevel: "info",
  external: ["node:*"],
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
});

console.log("API server build completed.");
