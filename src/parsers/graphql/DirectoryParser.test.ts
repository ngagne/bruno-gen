import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DirectoryParser } from "./DirectoryParser.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("DirectoryParser", () => {
  const parser = new DirectoryParser();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "graphql-dir-"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers .graphql files recursively", async () => {
    // Create directory structure
    const typesDir = path.join(tmpDir, "types");
    const queriesDir = path.join(tmpDir, "queries");
    fs.mkdirSync(typesDir, { recursive: true });
    fs.mkdirSync(queriesDir, { recursive: true });

    fs.writeFileSync(path.join(typesDir, "user.graphql"), "type User { id: ID! name: String! }");
    fs.writeFileSync(path.join(queriesDir, "queries.graphql"), "type Query { users: [User] }");

    const ir = await parser.parse({ dirPath: tmpDir });

    expect(ir.endpoints).toHaveLength(1);
    expect(ir.endpoints[0].id).toBe("users");
    expect(ir.components.schemas).toHaveProperty("User");
  });

  it("skips node_modules and test directories", async () => {
    const nodeModulesDir = path.join(tmpDir, "node_modules", "some-pkg");
    const testDir = path.join(tmpDir, "__tests__");
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });

    fs.writeFileSync(
      path.join(nodeModulesDir, "schema.graphql"),
      "type ShouldNotAppear { id: ID! }",
    );
    fs.writeFileSync(path.join(testDir, "test.graphql"), "type ShouldNotAppearTest { id: ID! }");

    const files = (
      parser as unknown as { findGraphqlFiles: (dir: string) => string[] }
    ).findGraphqlFiles(tmpDir);
    // Only the files from the previous test should be found, not the ones in node_modules/__tests__
    const hasSkippedType = files.some((f: string) =>
      fs.readFileSync(f, "utf-8").includes("ShouldNotAppear"),
    );
    expect(hasSkippedType).toBe(false);
  });

  it("throws error for directory with no .graphql files", async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty-graphql-"));
    fs.writeFileSync(path.join(emptyDir, "readme.txt"), "No graphql files here");

    await expect(parser.parse({ dirPath: emptyDir })).rejects.toThrow(
      "No .graphql or .gql files found",
    );

    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it("recognizes directories with .gql files and rejects invalid paths", () => {
    const gqlDir = fs.mkdtempSync(path.join(os.tmpdir(), "gql-dir-"));
    const gqlFile = path.join(gqlDir, "schema.gql");
    fs.writeFileSync(gqlFile, "type Query { ping: String }");

    expect(parser.canParse({ _dirPath: gqlDir })).toBe(true);
    expect(parser.canParse({ _dirPath: gqlFile })).toBe(false);
    expect(parser.canParse({ _dirPath: path.join(gqlDir, "missing") })).toBe(false);
    expect(parser.canParse({})).toBe(false);

    fs.rmSync(gqlDir, { recursive: true, force: true });
  });

  it("distinguishes missing paths from files during parse", async () => {
    const missing = path.join(os.tmpdir(), "missing-graphql-directory");
    const file = path.join(tmpDir, "not-a-directory.txt");
    fs.writeFileSync(file, "text");

    await expect(parser.parse({ dirPath: missing })).rejects.toThrow(
      `Directory not found: ${missing}`,
    );
    await expect(parser.parse({ dirPath: file })).rejects.toThrow(`Not a directory: ${file}`);
  });

  it("aggregates validation errors across schema files", async () => {
    const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), "invalid-graphql-"));
    fs.writeFileSync(path.join(invalidDir, "valid.graphql"), "type Query { ping: String }");
    fs.writeFileSync(path.join(invalidDir, "invalid.gql"), "type Broken {");

    const result = await parser.validate({ dirPath: invalidDir });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    fs.rmSync(invalidDir, { recursive: true, force: true });
  });

  it("treats unreadable or absent scan roots as containing no schemas", async () => {
    await expect(
      parser.validate({ dirPath: path.join(tmpDir, "does-not-exist") }),
    ).resolves.toEqual({ valid: true, errors: [], warnings: [] });
  });
});
