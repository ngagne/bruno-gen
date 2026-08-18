/**
 * The complete, side-effect-free description of a generated collection.
 *
 * This is the seam between rendering an IR and writing it to disk. Consumers
 * can render the plan (the CLI dry run) or materialize it (the orchestrator)
 * without reimplementing grouping, naming, or content generation.
 */

import type { CollectionIR, EndpointIR } from "../ir/index.js";
import { generateBrunoJson } from "./bruno-json-generator.js";
import { generateCollectionBru } from "./collection-generator.js";
import { generateAuthVars } from "./environment-generator.js";
import { generateFolderGroups } from "./folder-generator.js";
import { formatBlock } from "./bru-serializer.js";
import { generateRequestBru } from "./request-generator.js";
import { sanitizeRequestFilename } from "./path-sanitizer.js";

type Grouping = "tag" | "path" | "flat";
type PlannedFileKind = "manifest" | "collection" | "environment" | "folder" | "request";

interface CollectionPlanOptions {
  grouping?: Grouping;
  generateTests?: boolean;
}

interface PlannedFile {
  /** POSIX-style path relative to the output directory. */
  relativePath: string;
  content: string;
  kind: PlannedFileKind;
  endpoint?: EndpointIR;
  folder?: string;
}

interface CollectionPlan {
  files: PlannedFile[];
  warnings: string[];
}

/** Create all collection files without touching the filesystem. */
function planCollection(ir: CollectionIR, options: CollectionPlanOptions = {}): CollectionPlan {
  const files: PlannedFile[] = [
    { relativePath: "bruno.json", content: generateBrunoJson(ir), kind: "manifest" },
    { relativePath: "collection.bru", content: generateCollectionBru(ir), kind: "collection" },
  ];
  const warnings: string[] = [];

  const environmentVars = collectEnvironmentVars(ir);
  if (Object.keys(environmentVars).length > 0) {
    files.push({
      relativePath: "environments/default.bru",
      content: formatBlock("vars", environmentVars),
      kind: "environment",
    });
  }

  let groups = generateFolderGroups(ir, { format: options.grouping });
  if (groups.length === 1 && groups[0].folderName === "ungrouped") {
    groups = generateFolderGroups(ir, { format: "flat" });
  }

  const usedFilenames = new Set<string>();
  for (const group of groups) {
    const directory = group.folderName;
    if (group.folderBru) {
      files.push({
        relativePath: joinPath(directory, "folder.bru"),
        content: group.folderBru,
        kind: "folder",
        folder: directory,
      });
    }

    for (const [index, endpoint] of group.endpoints.entries()) {
      const filename = sanitizeRequestFilename(endpoint, usedFilenames);
      files.push({
        relativePath: joinPath(directory, filename),
        content: generateRequestBru(endpoint, ir, {
          seq: index + 1,
          baseUrl: "{{baseUrl}}",
          generateTests: options.generateTests,
        }),
        kind: "request",
        endpoint,
        folder: directory,
      });

      if (endpoint.deprecated) {
        warnings.push(`Endpoint ${endpoint.id} is deprecated`);
      }
    }
  }

  return { files, warnings };
}

function collectEnvironmentVars(ir: CollectionIR): Record<string, string> {
  const vars = generateAuthVars(ir.securitySchemes);

  for (const [name, serverVar] of Object.entries(ir.servers[0]?.variables ?? {})) {
    if (serverVar.default) vars[name] = serverVar.default;
  }
  for (const endpoint of ir.endpoints) {
    for (const parameter of endpoint.parameters) {
      if (parameter.required && vars[parameter.name] === undefined) {
        vars[parameter.name] = String(parameter.example ?? parameter.schema.default ?? "");
      }
    }
  }

  return vars;
}

function joinPath(directory: string, filename: string): string {
  return directory ? `${directory}/${filename}` : filename;
}

export { planCollection };
export type { CollectionPlan, CollectionPlanOptions, PlannedFile, PlannedFileKind };
