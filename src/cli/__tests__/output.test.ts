import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isInteractive, formatSummary, createSpinner, formatError } from "../output.js";

describe("cli/output", () => {
  const originalEnv = process.env;
  const originalTTY = process.stdout?.isTTY;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.NO_COLOR;
    // Default: non-TTY for predictable testing
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalTTY,
      configurable: true,
    });
  });

  describe("isInteractive", () => {
    it("returns false when no TTY", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = false;
      expect(isInteractive()).toBe(false);
    });

    it("returns true when TTY and no CI/NO_COLOR", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = true;
      expect(isInteractive()).toBe(true);
    });

    it("returns false when CI=true even with TTY", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = true;
      process.env.CI = "true";
      expect(isInteractive()).toBe(false);
    });

    it("returns false when NO_COLOR=true even with TTY", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = true;
      process.env.NO_COLOR = "true";
      expect(isInteractive()).toBe(false);
    });

    it("returns false when NO_COLOR=1", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = true;
      process.env.NO_COLOR = "1";
      expect(isInteractive()).toBe(false);
    });
  });

  describe("createSpinner", () => {
    it("returns no-op spinner in non-TTY mode", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = false;
      const spinner = createSpinner("Loading...");
      const result = spinner.start();
      // Should not throw, should return chainable object
      expect(() => result.succeed("Done")).not.toThrow();
      expect(() => result.fail("Error")).not.toThrow();
    });

    it("returns chainable no-op in non-TTY mode", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = false;
      const spinner = createSpinner("Loading...");
      expect(spinner.start()).toBeDefined();
    });
  });

  describe("formatSummary", () => {
    it("produces plain text output in non-TTY mode", () => {
      (process.stdout as unknown as { isTTY: boolean }).isTTY = false;
      const result = formatSummary({
        endpoints: 5,
        filesWritten: 12,
        warnings: 1,
        elapsed: 150,
      });
      expect(result).toContain("Endpoints: 5");
      expect(result).toContain("Files written: 12");
      expect(result).toContain("Warnings: 1");
      expect(result).toContain("Time: 150ms");
    });
  });

  describe("formatError", () => {
    it("returns clean message without stack in non-verbose mode", () => {
      const error = new Error("Something went wrong");
      error.stack = "Error: Something went wrong\n  at someFile.ts:10:5";
      const result = formatError(error, false);
      expect(result).toBe("Error: Something went wrong\n");
      expect(result).not.toContain("at someFile.ts");
    });

    it("includes stack trace in verbose mode", () => {
      const error = new Error("Something went wrong");
      error.stack = "Error: Something went wrong\n  at someFile.ts:10:5";
      const result = formatError(error, true);
      expect(result).toContain("Something went wrong");
      expect(result).toContain("at someFile.ts");
    });
  });
});
