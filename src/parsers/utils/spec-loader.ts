import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/**
 * Load a spec file from disk, detecting JSON vs YAML by extension.
 *
 * @param filePath - Absolute or relative path to the spec file
 * @returns Parsed spec object and source path
 * @throws Error if file cannot be read or parsed
 */
export function loadSpec(filePath: string): { data: Record<string, unknown>; source: string } {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Spec file not found: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const content = fs.readFileSync(absolutePath, "utf-8");

  let data: unknown;

  try {
    if (ext === ".json") {
      data = JSON.parse(content);
    } else if (ext === ".yaml" || ext === ".yml") {
      data = yaml.load(content, { schema: yaml.CORE_SCHEMA }) as unknown;
    } else {
      // Unknown extension — try JSON first, then YAML
      try {
        data = JSON.parse(content);
      } catch {
        data = yaml.load(content, { schema: yaml.CORE_SCHEMA }) as unknown;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse spec file ${absolutePath}: ${message}`);
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`Invalid spec file ${absolutePath}: expected a JSON/YAML object`);
  }

  return { data: data as Record<string, unknown>, source: absolutePath };
}
