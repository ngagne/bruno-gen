import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { parse } from "../../src/parsers/parse.js";
import { generate } from "../../src/generators/orchestrator.js";

const fixturesDir = join(process.cwd(), "test/fixtures");
const stripeFixture = join(fixturesDir, "stripe-like/openapi.yaml");
const githubFixture = join(fixturesDir, "github-like/openapi.yaml");
const petstoreFixture = join(fixturesDir, "petstore/openapi.yaml");

describe("Real-world fixture integration tests", () => {
  describe("stripe-like fixture", () => {
    it("parses successfully", async () => {
      const ir = await parse(stripeFixture);
      expect(ir).toBeDefined();
      expect(ir.info.title).toBe("Stripe-like Payment API");
      expect(ir.endpoints.length).toBeGreaterThan(0);
    });

    it("generates a Bruno collection", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "bruno-stripe-"));

      try {
        const ir = await parse(stripeFixture);
        const result = await generate(ir, { outputDir, grouping: "tag", generateTests: false });

        expect(result.success).toBe(true);
        expect(result.filesWritten.length).toBeGreaterThan(2); // collection.bru + env + at least 1 request

        // Verify collection.bru exists
        expect(existsSync(join(outputDir, "collection.bru"))).toBe(true);

        // Verify at least one request .bru file exists
        const requestFiles = result.filesWritten.filter(
          (f) =>
            f.endsWith(".bru") &&
            !f.endsWith("collection.bru") &&
            !f.endsWith("folder.bru") &&
            !f.includes("/environments/"),
        );
        expect(requestFiles.length).toBeGreaterThan(0);

        // Verify environments/ directory exists with env file
        expect(existsSync(join(outputDir, "environments"))).toBe(true);
        const envFiles = readdirSync(join(outputDir, "environments")).filter((f) =>
          f.endsWith(".bru"),
        );
        expect(envFiles.length).toBeGreaterThan(0);

        // Verify .bru files contain expected content
        const collectionContent = readFileSync(join(outputDir, "collection.bru"), "utf-8");
        expect(collectionContent).toContain("Stripe-like Payment API");
        // baseUrl should be in collection.bru vars
        expect(collectionContent).toMatch(/baseUrl/);

        // Verify env file contains auth vars (baseUrl is now in collection.bru vars)
        const envContent = readFileSync(join(outputDir, "environments", envFiles[0]), "utf-8");
        expect(envContent).toMatch(/vars\s*\{/);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("github-like fixture", () => {
    it("parses successfully", async () => {
      const ir = await parse(githubFixture);
      expect(ir).toBeDefined();
      expect(ir.info.title).toBe("GitHub-like Repository API");
      expect(ir.endpoints.length).toBeGreaterThan(0);
    });

    it("generates a Bruno collection", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "bruno-github-"));

      try {
        const ir = await parse(githubFixture);
        const result = await generate(ir, { outputDir, grouping: "tag", generateTests: false });

        expect(result.success).toBe(true);
        expect(result.filesWritten.length).toBeGreaterThan(2);

        expect(existsSync(join(outputDir, "collection.bru"))).toBe(true);

        const requestFiles = result.filesWritten.filter(
          (f) =>
            f.endsWith(".bru") &&
            !f.endsWith("collection.bru") &&
            !f.endsWith("folder.bru") &&
            !f.includes("/environments/"),
        );
        expect(requestFiles.length).toBeGreaterThan(0);

        expect(existsSync(join(outputDir, "environments"))).toBe(true);
        const envFiles = readdirSync(join(outputDir, "environments")).filter((f) =>
          f.endsWith(".bru"),
        );
        expect(envFiles.length).toBeGreaterThan(0);

        // Check for expected HTTP methods in request files (format: "get {", "post {", etc.)
        const hasGet = requestFiles.some((f) => {
          const content = readFileSync(f, "utf-8");
          return content.match(/^get\s*\{/m);
        });
        const hasPost = requestFiles.some((f) => {
          const content = readFileSync(f, "utf-8");
          return content.match(/^post\s*\{/m);
        });
        expect(hasGet || hasPost).toBe(true);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("petstore fixture", () => {
    it("parses successfully", async () => {
      const ir = await parse(petstoreFixture);
      expect(ir).toBeDefined();
      expect(ir.info.title).toBe("Petstore API");
      expect(ir.endpoints.length).toBeGreaterThanOrEqual(4);
    });

    it("generates a Bruno collection", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "bruno-petstore-"));

      try {
        const ir = await parse(petstoreFixture);
        const result = await generate(ir, { outputDir, grouping: "tag", generateTests: false });

        expect(result.success).toBe(true);
        expect(result.filesWritten.length).toBeGreaterThan(2);

        expect(existsSync(join(outputDir, "collection.bru"))).toBe(true);

        const requestFiles = result.filesWritten.filter(
          (f) =>
            f.endsWith(".bru") &&
            !f.endsWith("collection.bru") &&
            !f.endsWith("folder.bru") &&
            !f.includes("/environments/"),
        );
        expect(requestFiles.length).toBeGreaterThan(0);

        // Verify collection name and baseUrl in vars
        const collectionContent = readFileSync(join(outputDir, "collection.bru"), "utf-8");
        expect(collectionContent).toContain("Petstore API");
        expect(collectionContent).toMatch(/baseUrl/);
        // No environments/ directory since there are no auth schemes or server vars
        expect(existsSync(join(outputDir, "environments"))).toBe(false);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});
