/**
 * Orchestrator — coordinates all sub-generators.
 * Main generate() function that creates a complete Bruno collection from CollectionIR.
 */

import type { CollectionIR } from "../ir/index.js";
import { prepareOutputDir, writeBruFile } from "./file-writer.js";
import { generateCollectionBru } from "./collection-generator.js";
import { generateEnvironmentBru } from "./environment-generator.js";
import { generateFolderGroups } from "./folder-generator.js";
import { generateRequestBru } from "./request-generator.js";
import { sanitizeRequestFilename } from "./path-sanitizer.js";

interface GenerateOptions {
  /** Output directory path. */
  outputDir: string;
  /** Force regeneration (clean existing). */
  force?: boolean;
  /** Grouping strategy: 'tag' | 'path' | 'flat'. Default: 'tag'. */
  grouping?: "tag" | "path" | "flat";
  /** Generate post-response test assertions. */
  generateTests?: boolean;
}

interface GenerateResult {
  success: boolean;
  filesWritten: string[];
  warnings: string[];
}

/**
 * Main entry point — generate a complete Bruno collection from IR.
 * @param ir - The collection IR
 * @param options - Generation options
 * @returns Result with files written and any warnings
 */
async function generate(ir: CollectionIR, options: GenerateOptions): Promise<GenerateResult> {
  const filesWritten: string[] = [];
  const warnings: string[] = [];
  const usedFilenames = new Set<string>();

  try {
    // Step 1: Prepare output directory
    await prepareOutputDir(options.outputDir);

    // Step 2: Generate collection.bru
    const collectionBru = generateCollectionBru(ir);
    const collectionPath = `${options.outputDir}/collection.bru`;
    const collectionResult = await writeBruFile(collectionBru, collectionPath);
    if (collectionResult.success) {
      filesWritten.push(collectionPath);
    } else {
      warnings.push(`Failed to write collection.bru: ${collectionResult.error}`);
    }

    // Step 3: Generate environment file
    const envBru = generateEnvironmentBru(ir);
    const envPath = `${options.outputDir}/environments/default.bru`;
    const envResult = await writeBruFile(envBru, envPath);
    if (envResult.success) {
      filesWritten.push(envPath);
    } else {
      warnings.push(`Failed to write environment file: ${envResult.error}`);
    }

    // Step 4: Generate folder groups and request files
    const folderGroups = generateFolderGroups(ir, { format: options.grouping });

    for (const group of folderGroups) {
      // Determine the directory for request files
      // In flat mode, files go directly in outputDir
      const folderDir = group.folderName
        ? `${options.outputDir}/${group.folderName}`
        : options.outputDir;

      if (group.folderName) {
        await prepareOutputDir(folderDir);
      }

      // Write folder.bru (skip in flat mode)
      if (group.folderBru) {
        const folderBruPath = `${folderDir}/folder.bru`;
        const folderResult = await writeBruFile(group.folderBru, folderBruPath);
        if (folderResult.success) {
          filesWritten.push(folderBruPath);
        } else {
          warnings.push(
            `Failed to write folder.bru for ${group.displayName}: ${folderResult.error}`,
          );
        }
      }

      // Write request files for each endpoint in this folder
      for (let i = 0; i < group.endpoints.length; i++) {
        const endpoint = group.endpoints[i];

        // Generate request.bru content
        const requestBru = generateRequestBru(endpoint, ir, {
          seq: i + 1,
          baseUrl: "{{baseUrl}}",
          generateTests: options.generateTests,
        });

        // Generate safe filename
        const filename = sanitizeRequestFilename(endpoint, usedFilenames);
        const requestPath = `${folderDir}/${filename}`;

        const requestResult = await writeBruFile(requestBru, requestPath);
        if (requestResult.success) {
          filesWritten.push(requestPath);
        } else {
          warnings.push(`Failed to write request file ${filename}: ${requestResult.error}`);
        }

        // Add warning for deprecated endpoints
        if (endpoint.deprecated) {
          warnings.push(`Endpoint ${endpoint.id} is deprecated`);
        }
      }
    }

    return {
      success: warnings.length === 0,
      filesWritten,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      filesWritten,
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export { generate };
export type { GenerateOptions, GenerateResult };
