import { describe, it, expect } from "vitest";
import { loadSpec } from "./spec-loader.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("spec-loader", () => {
  const tmpDir = os.tmpdir();

  it("loads YAML spec files", () => {
    const filePath = path.join(tmpDir, "test-spec.yaml");
    fs.writeFileSync(filePath, "openapi: '3.0.0'\ninfo:\n  title: Test\n  version: '1.0.0'\n");

    const result = loadSpec(filePath);
    expect(result.data).toHaveProperty("openapi", "3.0.0");
    expect(result.source).toBe(path.resolve(filePath));

    fs.unlinkSync(filePath);
  });

  it("loads JSON spec files", () => {
    const filePath = path.join(tmpDir, "test-spec.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({ openapi: "3.0.0", info: { title: "Test", version: "1.0.0" } }),
    );

    const result = loadSpec(filePath);
    expect(result.data).toHaveProperty("openapi", "3.0.0");
    expect(result.source).toBe(path.resolve(filePath));

    fs.unlinkSync(filePath);
  });

  it("throws error for non-existent file", () => {
    expect(() => loadSpec("/nonexistent/file.yaml")).toThrow("Spec file not found");
  });

  it("throws error for invalid YAML", () => {
    const filePath = path.join(tmpDir, "invalid.yaml");
    fs.writeFileSync(filePath, ": invalid: yaml: [");

    expect(() => loadSpec(filePath)).toThrow("Failed to parse spec file");

    fs.unlinkSync(filePath);
  });

  it("throws error for invalid JSON", () => {
    const filePath = path.join(tmpDir, "invalid.json");
    fs.writeFileSync(filePath, "{ invalid json }");

    expect(() => loadSpec(filePath)).toThrow("Failed to parse spec file");

    fs.unlinkSync(filePath);
  });
});
