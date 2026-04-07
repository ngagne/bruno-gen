import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";

const cliPath = join(process.cwd(), "dist/cli.js");
const fixturesDir = join(process.cwd(), "test-fixtures-cli");

describe("CLI", () => {
  beforeAll(() => {
    mkdirSync(fixturesDir, { recursive: true });

    // Valid minimal OpenAPI spec
    writeFileSync(
      join(fixturesDir, "valid.yaml"),
      `openapi: "3.0.0"\ninfo:\n  title: Test API\n  version: "1.0.0"\npaths:\n  /users:\n    get:\n      operationId: list-users\n      summary: List users\n      responses:\n        "200":\n          description: OK\n          content:\n            application/json:\n              schema:\n                type: object\n                required: [id, name]\n                properties:\n                  id:\n                    type: integer\n                    example: 1\n                  name:\n                    type: string\n                    example: Test\n`,
    );

    // Invalid/malformed spec
    writeFileSync(join(fixturesDir, "invalid.yaml"), `this: is: not: a: valid: spec\n[broken`);
  });

  afterAll(() => {
    try {
      rmSync(fixturesDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("exits 0 and generates collection for valid spec", async () => {
    const outputDir = join(fixturesDir, "output-valid");
    const result = await runCli([join(fixturesDir, "valid.yaml"), outputDir]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(outputDir, "collection.bru"))).toBe(true);
  });

  it("exits 1 for missing spec file", async () => {
    const result = await runCli(["/nonexistent/path/spec.yaml", join(fixturesDir, "out")]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Spec file not found");
  });

  it("exits 1 for invalid spec", async () => {
    const result = await runCli([
      join(fixturesDir, "invalid.yaml"),
      join(fixturesDir, "output-invalid"),
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("supports --dry-run without writing files", async () => {
    const result = await runCli([join(fixturesDir, "valid.yaml"), "--dry-run"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("dry run");
  });

  it("supports --tests flag", async () => {
    const outputDir = join(fixturesDir, "output-tests");
    const result = await runCli([join(fixturesDir, "valid.yaml"), outputDir, "--tests"]);
    expect(result.exitCode).toBe(0);
  });

  it("supports --format path flag", async () => {
    const outputDir = join(fixturesDir, "output-path");
    const result = await runCli([join(fixturesDir, "valid.yaml"), outputDir, "--format", "path"]);
    expect(result.exitCode).toBe(0);
  });

  it("supports --format flat flag", async () => {
    const outputDir = join(fixturesDir, "output-flat");
    const result = await runCli([join(fixturesDir, "valid.yaml"), outputDir, "--format", "flat"]);
    expect(result.exitCode).toBe(0);
  });

  it("produces clean output in CI mode (no ANSI)", async () => {
    const result = await runCli([join(fixturesDir, "valid.yaml"), "--dry-run"], { CI: "true" });
    expect(result.exitCode).toBe(0);
    // Should not contain ANSI escape codes (ESC char = \u001b)
    const ansiPattern = String.fromCharCode(27) + "[";
    expect(result.stdout).not.toContain(ansiPattern);
  });
});

function runCli(
  args: string[],
  envOverrides: Record<string, string> = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = execFile("node", [cliPath, ...args], {
      env: { ...process.env, ...envOverrides },
      timeout: 30000,
    });

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("exit", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}
