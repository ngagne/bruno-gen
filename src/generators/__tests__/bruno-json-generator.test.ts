import { describe, it, expect } from "vitest";
import { generateBrunoJson } from "../bruno-json-generator.js";
import type { CollectionIR } from "../../ir/index.js";

describe("bruno-json-generator", () => {
  const baseIR: CollectionIR = {
    info: {
      title: "Test API",
      version: "1.0.0",
    },
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

  it("generates minimal bruno.json with type, name and version", () => {
    const result = generateBrunoJson(baseIR);
    const parsed = JSON.parse(result);

    expect(parsed.type).toBe("collection");
    expect(parsed.name).toBe("Test API");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.scripts).toBeDefined();
    expect(parsed.scripts.filesystemAccess.allow).toBe(false);
  });

  it("includes description when available", () => {
    const ir: CollectionIR = {
      ...baseIR,
      info: {
        ...baseIR.info,
        description: "A test API collection",
      },
    };

    const result = generateBrunoJson(ir);
    const parsed = JSON.parse(result);

    expect(parsed.description).toBe("A test API collection");
  });

  it("omits description when not available", () => {
    const result = generateBrunoJson(baseIR);
    const parsed = JSON.parse(result);

    expect(parsed.description).toBeUndefined();
  });

  it("produces valid JSON output", () => {
    const result = generateBrunoJson(baseIR);

    // Should not throw
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("formats JSON with 2-space indentation", () => {
    const result = generateBrunoJson(baseIR);

    expect(result).toContain('  "name"');
    expect(result).toContain('  "version"');
  });

  it("ends with newline", () => {
    const result = generateBrunoJson(baseIR);

    expect(result.endsWith("\n")).toBe(true);
  });
});
