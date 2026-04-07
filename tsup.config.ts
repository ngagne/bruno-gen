import { defineConfig } from "tsup";

export default defineConfig([
  // Library entry point — cleans output folder first
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: true,
    target: "es2022",
    platform: "node",
    cjsInterop: true,
    bundle: true,
  },
  // CLI entry point — ESM only, runs directly via node, appends to dist
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    sourcemap: true,
    clean: false, // Don't clean — library build already happened
    target: "es2022",
    platform: "node",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
