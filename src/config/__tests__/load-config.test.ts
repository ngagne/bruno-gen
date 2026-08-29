import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { loadConfig } from "../../config/load-config.js";

const fixturesDir = join(process.cwd(), "test-fixtures-config");

describe("loadConfig", () => {
  beforeAll(() => {
    mkdirSync(fixturesDir, { recursive: true });

    // YAML config
    writeFileSync(
      join(fixturesDir, "brunogen.config.yaml"),
      `spec: ./openapi.yaml\nformat: tag\ntests: true\nforce: true\n`,
    );

    // JSON config
    writeFileSync(
      join(fixturesDir, "brunogen.config.json"),
      `{"spec": "./api.json", "format": "path", "tests": false}`,
    );

    // YML extension
    writeFileSync(join(fixturesDir, "brunogen.config.yml"), `spec: ./other.yaml\nformat: flat\n`);

    // Invalid YAML
    writeFileSync(
      join(fixturesDir, "brunogen.config.invalid.yaml"),
      `this: is: not: [valid\n  yaml: {`,
    );
  });

  afterAll(() => {
    try {
      rmSync(fixturesDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("auto-discovers YAML config in CWD", async () => {
    // Create a temp dir with just the YAML config
    const tempDir = join(fixturesDir, "auto-discover-yaml");
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "brunogen.config.yml"), `spec: ./my-api.yaml\nformat: path\n`);

    const config = await loadConfig(tempDir);
    expect(config.spec).toBe("./my-api.yaml");
    expect(config.format).toBe("path");
  });

  it("auto-discovers JSON config in CWD", async () => {
    const tempDir = join(fixturesDir, "auto-discover-json");
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "brunogen.config.json"), `{"spec": "./api.json", "tests": true}`);

    const config = await loadConfig(tempDir);
    expect(config.spec).toBe("./api.json");
    expect(config.tests).toBe(true);
  });

  it("explicit path overrides auto-discovery", async () => {
    const config = await loadConfig(fixturesDir, join(fixturesDir, "brunogen.config.json"));
    expect(config.spec).toBe("./api.json");
    expect(config.format).toBe("path");
  });

  it("missing config returns empty defaults", async () => {
    const tempDir = join(fixturesDir, "no-config");
    mkdirSync(tempDir, { recursive: true });

    const config = await loadConfig(tempDir);
    expect(config).toEqual({});
  });

  it("returns empty defaults for a missing explicit config", async () => {
    await expect(loadConfig(undefined, join(fixturesDir, "missing.yaml"))).resolves.toEqual({});
  });

  it("parses YAML correctly", async () => {
    const config = await loadConfig(fixturesDir, join(fixturesDir, "brunogen.config.yaml"));
    expect(config.spec).toBe("./openapi.yaml");
    expect(config.format).toBe("tag");
    expect(config.tests).toBe(true);
    expect(config.force).toBe(true);
  });

  it("parses JSON correctly", async () => {
    const config = await loadConfig(fixturesDir, join(fixturesDir, "brunogen.config.json"));
    expect(config.spec).toBe("./api.json");
    expect(config.format).toBe("path");
    expect(config.tests).toBe(false);
  });

  it("throws on invalid YAML/JSON", async () => {
    await expect(
      loadConfig(fixturesDir, join(fixturesDir, "brunogen.config.invalid.yaml")),
    ).rejects.toThrow(/Failed to parse config file/);
  });

  it("first match wins in auto-discovery (YML before YAML before JSON)", async () => {
    // fixturesDir has brunogen.config.yaml, .json, and .yml
    // YML comes first in CONFIG_FILENAMES, so it should win
    const config = await loadConfig(fixturesDir);
    expect(config.spec).toBe("./other.yaml"); // from brunogen.config.yml
  });

  it("parses extensionless JSON and YAML configs", async () => {
    const jsonPath = join(fixturesDir, "json-config");
    const yamlPath = join(fixturesDir, "yaml-config");
    writeFileSync(jsonPath, '{"format":"flat"}');
    writeFileSync(yamlPath, "format: tag\ntests: true\n");

    await expect(loadConfig(undefined, jsonPath)).resolves.toMatchObject({ format: "flat" });
    await expect(loadConfig(undefined, yamlPath)).resolves.toMatchObject({
      format: "tag",
      tests: true,
    });
  });

  it("wraps invalid extensionless config errors with the source path", async () => {
    const invalidPath = join(fixturesDir, "invalid-config");
    writeFileSync(invalidPath, "value: [unterminated");
    await expect(loadConfig(undefined, invalidPath)).rejects.toThrow(
      `Failed to parse config file ${invalidPath}`,
    );
  });
});
