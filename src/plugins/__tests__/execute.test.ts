import { describe, it, expect } from "vitest";
import { executeTransformIR, executePreOutput } from "../../plugins/execute.js";
import type { Plugin, PluginContext } from "../../plugins/types.js";
import type { CollectionIR } from "../../ir/collection.js";

// Minimal mock CollectionIR for testing
function makeMockIR(): CollectionIR {
  return {
    info: { title: "Test", version: "1.0.0" },
    servers: [],
    securitySchemes: {},
    defaultSecurity: [],
    tags: [],
    endpoints: [],
    components: {
      schemas: {},
      parameters: {},
      responses: {},
      requestBodies: {},
    },
    extensions: {},
  };
}

describe("executeTransformIR", () => {
  it("returns IR unchanged when no plugins have transformIR hook", async () => {
    const ir = makeMockIR();
    const plugins: Plugin[] = [{ name: "pre-only", hooks: { preOutput: async (c: string) => c } }];
    const context: PluginContext = { specPath: "test.yaml", options: {} };
    const result = await executeTransformIR(ir, plugins, context);
    expect(result).toBe(ir);
  });

  it("waterfall: multiple plugins chain correctly", async () => {
    const plugins: Plugin[] = [
      {
        name: "add-title-prefix",
        hooks: {
          async transformIR(ir) {
            return { ...ir, info: { ...ir.info, title: "PREFIX: " + ir.info.title } };
          },
        },
      },
      {
        name: "add-title-suffix",
        hooks: {
          async transformIR(ir) {
            return { ...ir, info: { ...ir.info, title: ir.info.title + " :SUFFIX" } };
          },
        },
      },
    ];

    const ir = makeMockIR();
    const context: PluginContext = { specPath: "test.yaml", options: {} };
    const result = await executeTransformIR(ir, plugins, context);

    expect(result.info.title).toBe("PREFIX: Test :SUFFIX");
  });

  it("plugin hook error halts with plugin name in message", async () => {
    const plugins: Plugin[] = [
      {
        name: "bad-plugin",
        hooks: {
          async transformIR() {
            throw new Error("intentional failure");
          },
        },
      },
    ];

    const ir = makeMockIR();
    const context: PluginContext = { specPath: "test.yaml", options: {} };
    await expect(executeTransformIR(ir, plugins, context)).rejects.toThrow(
      /Plugin 'bad-plugin' transformIR hook failed: intentional failure/,
    );
  });
});

describe("executePreOutput", () => {
  it("returns content unchanged when no plugins have preOutput hook", async () => {
    const content = "docs { some content }";
    const plugins: Plugin[] = [
      { name: "transform-only", hooks: { transformIR: async (ir) => ir } },
    ];
    const result = await executePreOutput(content, { filePath: "test.bru" }, plugins);
    expect(result).toBe(content);
  });

  it("waterfall: multiple plugins chain correctly", async () => {
    const plugins: Plugin[] = [
      {
        name: "add-header",
        hooks: {
          async preOutput(content) {
            return `// Added by plugin A\n${content}`;
          },
        },
      },
      {
        name: "add-footer",
        hooks: {
          async preOutput(content) {
            return `${content}\n// Added by plugin B`;
          },
        },
      },
    ];

    const content = "original content";
    const result = await executePreOutput(content, { filePath: "test.bru" }, plugins);
    expect(result).toContain("Added by plugin A");
    expect(result).toContain("Added by plugin B");
    expect(result).toContain("original content");
  });

  it("plugin hook error halts with plugin name in message", async () => {
    const plugins: Plugin[] = [
      {
        name: "failing-pre",
        hooks: {
          async preOutput() {
            throw new Error("pre-output failure");
          },
        },
      },
    ];

    await expect(executePreOutput("content", { filePath: "test.bru" }, plugins)).rejects.toThrow(
      /Plugin 'failing-pre' preOutput hook failed: pre-output failure/,
    );
  });
});
