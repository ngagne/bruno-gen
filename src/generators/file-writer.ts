/**
 * Atomic file writes and directory structure creation.
 * Writes to temp file first, then renames to avoid partial output.
 */

import { mkdir, writeFile, rename, readFile } from "fs/promises";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

interface WriteResult {
  path: string;
  success: boolean;
  error?: string;
}

/**
 * Ensure directory exists, creating parents as needed.
 */
async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Write a .bru file atomically (write to temp, then rename).
 * @param content - The content to write
 * @param outputPath - The final output path
 * @returns Result indicating success or failure
 */
async function writeBruFile(content: string, outputPath: string): Promise<WriteResult> {
  try {
    // Ensure parent directory exists
    const parentDir = dirname(outputPath);
    await ensureDir(parentDir);

    // Write to temp file first
    const tempFileName = `${randomUUID()}.tmp`;
    const tempFilePath = join(tmpdir(), tempFileName);

    await writeFile(tempFilePath, content, "utf-8");

    // Atomic rename to final path
    await rename(tempFilePath, outputPath);

    return { path: outputPath, success: true };
  } catch (error) {
    return {
      path: outputPath,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create the full directory structure for a Bruno collection.
 * @param outputDir - The root output directory
 */
async function prepareOutputDir(outputDir: string): Promise<void> {
  await ensureDir(outputDir);
  await ensureDir(join(outputDir, "environments"));
}

/**
 * Read a file's content (utility for tests and verification).
 */
async function readBruFile(filePath: string): Promise<string> {
  return await readFile(filePath, "utf-8");
}

export { ensureDir, writeBruFile, prepareOutputDir, readBruFile };
export type { WriteResult };
