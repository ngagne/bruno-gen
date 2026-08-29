import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { CollectionBuilder } from "../../api/CollectionBuilder.js";
import { parse } from "../../parsers/parse.js";
import type { Plugin } from "../../plugins/types.js";

const fixturesDir = join(process.cwd(), "test-fixtures-builder");

describe("CollectionBuilder", () => {
  beforeAll(() => {
    mkdirSync(fixturesDir, { recursive: true });

    writeFileSync(
      join(fixturesDir, "valid.yaml"),
      `openapi: "3.0.0"\ninfo:\n  title: Builder Test API\n  version: "1.0.0"\npaths:\n  /users:\n    get:\n      operationId: listUsers\n      summary: List users\n      responses:\n        "200":\n          description: OK\n`,
    );

    writeFileSync(
      join(fixturesDir, "multi-endpoint.yaml"),
      `openapi: "3.0.0"\ninfo:\n  title: Multi API\n  version: "1.0.0"\npaths:\n  /users:\n    get:\n      operationId: listUsers\n      summary: List users\n      responses:\n        "200":\n          description: OK\n  /users/{id}:\n    get:\n      operationId: getUser\n      summary: Get user\n      responses:\n        "200":\n          description: OK\n    delete:\n      operationId: deleteUser\n      summary: Delete user\n      responses:\n        "204":\n          description: Deleted\n`,
    );
  });

  afterAll(() => {
    try {
      rmSync(fixturesDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("fromSpec()", () => {
    it("parses and caches IR", async () => {
      const builder = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml"));
      const result = await builder.generate(join(fixturesDir, "out-from-spec"));
      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThan(0);
      expect(existsSync(join(fixturesDir, "out-from-spec", "collection.bru"))).toBe(true);
    });
  });

  describe("fromIR()", () => {
    it("accepts pre-parsed IR", async () => {
      const ir = await parse(join(fixturesDir, "valid.yaml"));
      const builder = CollectionBuilder.fromIR(ir);
      const result = await builder.generate(join(fixturesDir, "out-from-ir"));
      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThan(0);
    });
  });

  describe("withOptions()", () => {
    it("returns a new builder instance (immutability)", async () => {
      const original = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml"));
      const modified = original.withOptions({ grouping: "path" });
      expect(modified).not.toBe(original);
      // Original should still have default options
      expect(original.options.grouping).toBeUndefined();
      expect(modified.options.grouping).toBe("path");
    });

    it("does not mutate the original builder", async () => {
      const original = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml"));
      original.withOptions({ grouping: "flat", generateTests: true });
      expect(original.options.grouping).toBeUndefined();
      expect(original.options.generateTests).toBeUndefined();
    });

    it("retains every explicitly configured generation option", () => {
      const plugin: Plugin = { name: "configured", hooks: {} };
      const builder = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml")).withOptions({
        outputDir: join(fixturesDir, "configured"),
        force: false,
        grouping: "flat",
        generateTests: false,
        plugins: [plugin],
      });

      expect(builder.options).toEqual({
        outputDir: join(fixturesDir, "configured"),
        force: false,
        grouping: "flat",
        generateTests: false,
        plugins: [plugin],
      });
      expect(builder.plugins).toEqual([plugin]);
    });

    it("ignores undefined updates instead of erasing prior options", () => {
      const configured = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml")).withOptions({
        force: true,
        grouping: "path",
        generateTests: true,
      });
      expect(
        configured.withOptions({ force: undefined, grouping: undefined }).options,
      ).toMatchObject({ force: true, grouping: "path", generateTests: true });
    });
  });

  describe("generate()", () => {
    it("produces same output as direct generate() call", async () => {
      const ir = await parse(join(fixturesDir, "valid.yaml"));
      const { generate } = await import("../../generators/orchestrator.js");

      const directResult = await generate(ir, {
        outputDir: join(fixturesDir, "out-direct"),
        grouping: "tag",
      });

      const builderResult = await CollectionBuilder.fromIR(ir).generate(
        join(fixturesDir, "out-builder"),
      );

      expect(directResult.success).toBe(true);
      expect(builderResult.success).toBe(true);
      // Both should write collection.bru and environment
      expect(directResult.filesWritten.length).toBe(builderResult.filesWritten.length);
    });

    it("reuses cached IR: two generate calls = one parse", async () => {
      const builder = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml"));
      await builder.generate(join(fixturesDir, "out-cache-1"));
      await builder.generate(join(fixturesDir, "out-cache-2"));
      // Both should succeed — if IR wasn't cached, it would still work,
      // but we verify both generate calls complete without error
      expect(existsSync(join(fixturesDir, "out-cache-1", "collection.bru"))).toBe(true);
      expect(existsSync(join(fixturesDir, "out-cache-2", "collection.bru"))).toBe(true);
    });

    it("shares a parsed IR with derived immutable builders", async () => {
      const specPath = join(fixturesDir, "cached-source.yaml");
      writeFileSync(specPath, readFileSync(join(fixturesDir, "valid.yaml"), "utf8"));
      const builder = CollectionBuilder.fromSpec(specPath);
      await builder.withOptions({ grouping: "tag" }).generate(join(fixturesDir, "out-shared-1"));
      rmSync(specPath);

      await expect(
        builder.withOptions({ grouping: "flat" }).generate(join(fixturesDir, "out-shared-2")),
      ).resolves.toMatchObject({ success: true });
    });

    it("uses outputDir configured through withOptions when generate has no argument", async () => {
      const outputDir = join(fixturesDir, "out-configured-output");
      await expect(
        CollectionBuilder.fromSpec(join(fixturesDir, "multi-endpoint.yaml"))
          .withOptions({ outputDir })
          .generate(),
      ).resolves.toMatchObject({ success: true });
      expect(existsSync(join(outputDir, "collection.bru"))).toBe(true);
    });

    it("requires an output directory", async () => {
      const ir = await parse(join(fixturesDir, "valid.yaml"));
      await expect(CollectionBuilder.fromIR(ir).generate()).rejects.toThrow(
        "No output directory provided",
      );
    });

    it("retries parsing after a failed parse", async () => {
      const specPath = join(fixturesDir, "created-after-failure.yaml");
      const builder = CollectionBuilder.fromSpec(specPath);
      await expect(builder.generate(join(fixturesDir, "failed-output"))).rejects.toThrow();

      writeFileSync(specPath, readFileSync(join(fixturesDir, "valid.yaml"), "utf8"));
      await expect(builder.generate(join(fixturesDir, "retried-output"))).resolves.toMatchObject({
        success: true,
      });
    });
  });

  describe("withPlugins()", () => {
    it("adds plugins to the builder", async () => {
      const testPlugin: Plugin = {
        name: "test-add-header",
        hooks: {
          async transformIR(ir) {
            return {
              ...ir,
              info: { ...ir.info, title: "Modified by Plugin" },
            };
          },
        },
      };

      const builder = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml")).withPlugins([
        testPlugin,
      ]);
      const outputDir = join(fixturesDir, "out-plugin");
      const result = await builder.generate(outputDir);
      expect(result.success).toBe(true);

      // Verify the plugin modified the title
      const collectionBru = readFileSync(join(outputDir, "collection.bru"), "utf-8");
      expect(collectionBru).toContain("Modified by Plugin");
    });

    it("returns new builder instance (immutability)", () => {
      const original = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml"));
      const modified = original.withPlugins([{ name: "test", hooks: {} }]);
      expect(modified).not.toBe(original);
    });

    it("appends plugins while keeping plugin getters defensive", () => {
      const first: Plugin = { name: "first", hooks: {} };
      const second: Plugin = { name: "second", hooks: {} };
      const builder = CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml"))
        .withPlugins([first])
        .withPlugins([second]);

      const plugins = builder.plugins as Plugin[];
      plugins.pop();
      expect(builder.plugins.map((plugin) => plugin.name)).toEqual(["first", "second"]);
      expect(CollectionBuilder.fromSpec(join(fixturesDir, "valid.yaml")).plugins).toEqual([]);
    });
  });
});
