import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

await rm(new URL("./lib", import.meta.url), { recursive: true, force: true });

await build({
  entryPoints: [fileURLToPath(new URL("./src/index.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: fileURLToPath(new URL("./lib/index.js", import.meta.url)),
  sourcemap: true,
  external: [
    "firebase-admin",
    "firebase-admin/*",
    "firebase-functions",
    "firebase-functions/*",
    "zod",
  ],
});
