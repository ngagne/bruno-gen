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

    const files = (parser as unknown as { findGraphqlFiles: (dir: string) => string[] }).findGraphqlFiles(tmpDir);
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
});
