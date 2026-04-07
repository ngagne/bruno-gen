import { describe, it, expect } from "vitest";
import { mergeConfig } from "../../config/merge.js";
import type { CollectionIR } from "../../ir/collection.js";

const noopTransform = async (ir: CollectionIR) => ir;

describe("mergeConfig", () => {
  it("CLI flag overrides config value", () => {
    const result = mergeConfig({ format: "tag" }, { format: "path" }, { format: "flat" });
    expect(result.format).toBe("flat");
  });

  it("config value overrides default", () => {
    const result = mergeConfig({ format: "tag" }, { format: "path" }, {});
    expect(result.format).toBe("path");
  });

  it("default used when neither config nor CLI provide value", () => {
    const result = mergeConfig({ format: "tag", tests: true }, {}, {});
    expect(result.format).toBe("tag");
    expect(result.tests).toBe(true);
  });

  it("plugin arrays concatenate (config + CLI)", () => {
    const configPlugin = { name: "config-plugin", hooks: { transformIR: noopTransform } };
    const cliPlugin = { name: "cli-plugin", hooks: { preOutput: async (c: string) => c } };

    const result = mergeConfig({}, { plugins: [configPlugin] }, { plugins: [cliPlugin] });

    expect(result.plugins).toHaveLength(2);
    expect(result.plugins?.[0]).toBe(configPlugin);
    expect(result.plugins?.[1]).toBe(cliPlugin);
  });

  it("unknown fields pass through", () => {
    const result = mergeConfig({}, { customField: "hello" } as Record<string, unknown>, {});
    expect((result as Record<string, unknown>).customField).toBe("hello");
  });

  it("full three-layer merge: outputDir and format", () => {
    const result = mergeConfig(
      { outputDir: "./bruno-output", format: "tag" },
      { outputDir: "./config-output" },
      { format: "path" },
    );
    expect(result.outputDir).toBe("./config-output");
    expect(result.format).toBe("path");
  });

  it("CLI plugins concatenate after config plugins", () => {
    const p1 = { name: "p1", hooks: { transformIR: noopTransform } };
    const p2 = { name: "p2", hooks: { transformIR: noopTransform } };
    const p3 = { name: "p3", hooks: { transformIR: noopTransform } };

    const result = mergeConfig({}, { plugins: [p1] }, { plugins: [p2, p3] });

    expect(result.plugins).toHaveLength(3);
    expect(result.plugins?.map((p) => (p as { name: string }).name)).toEqual(["p1", "p2", "p3"]);
  });
});
