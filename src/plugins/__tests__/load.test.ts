import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { loadPlugin } from "../../plugins/load.js";
import type { Plugin } from "../../plugins/types.js";
import type { CollectionIR } from "../../ir/collection.js";

const fixturesDir = join(process.cwd(), "test-fixtures-plugins");

describe("loadPlugin", () => {
  beforeAll(() => {
    mkdirSync(fixturesDir, { recursive: true });

    // Valid ESM plugin file
    writeFileSync(
      join(fixturesDir, "valid-plugin.mjs"),
      `export default {
  name: "file-plugin",
  hooks: {
    async transformIR(ir) { return ir; }
  }
};`,
    );
  });

  afterAll(() => {
    try {
      rmSync(fixturesDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("valid inline plugin passes validation", async () => {
    const plugin: Plugin = {
      name: "inline-plugin",
      hooks: {
        async transformIR(ir) {
          return ir;
        },
      },
    };
    const result = await loadPlugin(plugin);
    expect(result.name).toBe("inline-plugin");
    expect(result.hooks.transformIR).toBeDefined();
  });

  it("invalid plugin (no hooks) throws", async () => {
    const badPlugin = { name: "no-hooks" } as unknown as Plugin;
    await expect(loadPlugin(badPlugin)).rejects.toThrow(
      /Plugin 'no-hooks' is invalid: missing hooks/,
    );
  });

  it("invalid plugin (no name) throws", async () => {
    const badPlugin = {
      name: "",
      hooks: { transformIR: async (ir: CollectionIR) => ir },
    } as Plugin;
    await expect(loadPlugin(badPlugin)).rejects.toThrow(/invalid: missing or empty "name"/);
  });

  it("invalid plugin (no recognized hooks) throws", async () => {
    const badPlugin = {
      name: "empty-hooks",
      hooks: {
        someUnknownHook: async (_ir: CollectionIR) => _ir,
      },
    } as Plugin;
    await expect(loadPlugin(badPlugin)).rejects.toThrow(
      /Plugin 'empty-hooks' is invalid: no recognized hooks/,
    );
  });

  it("file path plugin loads via import()", async () => {
    const result = await loadPlugin(join(fixturesDir, "valid-plugin.mjs"));
    expect(result.name).toBe("file-plugin");
    expect(result.hooks.transformIR).toBeDefined();
  });

  it("nonexistent file path throws descriptive error", async () => {
    await expect(loadPlugin("/nonexistent/plugin.mjs")).rejects.toThrow(/Failed to load plugin/);
  });
});
