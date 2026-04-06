import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  target: "es2022",
  platform: "node",
  cjsInterop: true,
  bundle: false,
});
